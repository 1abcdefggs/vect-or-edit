import { pipeline, env } from '@huggingface/transformers';

env.allowLocalModels = false;
env.useBrowserCache = true;
env.useCustomCache = false;

// Configure WASM SIMD for CPU acceleration without crossOriginIsolated warnings
if (env.backends?.onnx?.wasm) {
    env.backends.onnx.wasm.numThreads = 1;
    env.backends.onnx.wasm.simd = true;
    env.backends.onnx.wasm.proxy = false;
}

class PipelineSingleton {
    static task = 'feature-extraction';
    static model = 'Xenova/multilingual-e5-small';
    static instance = null;
    static activeDevice = 'CPU (WebAssembly SIMD)';

    static async getInstance(modelName = null, progress_callback = null) {
        const targetModel = modelName || this.model;
        if (this.instance === null || this.model !== targetModel) {
            this.model = targetModel;
            this.instance = null; // Reset existing pipeline for new model
            // Use ultra-fast, robust, low-memory Int8 quantized WASM SIMD
            this.instance = await pipeline(this.task, this.model, { 
                progress_callback,
                device: 'wasm',
                quantized: true,
                dtype: 'q8'
            });
            this.activeDevice = 'CPU (WebAssembly SIMD)';
            console.log(`[Worker] Running ${this.model} on CPU (WebAssembly SIMD, int8 quantized)`);
            self.postMessage({ status: 'ready', model: this.model, device: this.activeDevice });
        }
        return this.instance;
    }
}

// Model will only be initialized when explicitly requested by the user
self.addEventListener('message', async (event) => {
    const { text, type, model, requestId } = event.data;
    if (type === 'init' || !text) {
        // Trigger model load or switch
        try {
            await PipelineSingleton.getInstance(model, x => self.postMessage({ ...x, requestId }));
        } catch (err) {
            self.postMessage({ status: 'error', error: err.message, requestId });
        }
        return;
    }
    
    try {
        let extractor = await PipelineSingleton.getInstance(model, x => {
            self.postMessage({ ...x, requestId });
        });

        // Apply optimal query prefix per model family
        let formattedText = text;
        const currentModel = PipelineSingleton.model.toLowerCase();
        if (currentModel.includes('e5')) {
            formattedText = `query: ${text}`;
        } else if (currentModel.includes('bge')) {
            formattedText = `Represent this sentence for searching relevant passages: ${text}`;
        }

        let output = await extractor(formattedText, { pooling: 'mean', normalize: true });

        self.postMessage({
            status: 'complete',
            requestId,
            model: PipelineSingleton.model,
            vector: Array.from(output.data)
        });
    } catch (err) {
        self.postMessage({
            status: 'error',
            requestId,
            error: err.message
        });
    }
});

