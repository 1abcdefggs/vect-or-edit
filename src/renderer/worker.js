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

    static async getInstance(progress_callback = null) {
        if (this.instance === null) {
            // Use ultra-fast, robust, low-memory (45MB) Int8 quantized WASM SIMD
            this.instance = await pipeline(this.task, this.model, { 
                progress_callback,
                device: 'wasm',
                quantized: true,
                dtype: 'q8'
            });
            this.activeDevice = 'CPU (WebAssembly SIMD)';
            console.log('[Worker] Running on CPU (WebAssembly SIMD, int8 quantized)');
            self.postMessage({ status: 'ready', device: this.activeDevice });
        }
        return this.instance;
    }
}

// Model will only be initialized when explicitly requested by the user
self.addEventListener('message', async (event) => {
    const { text, type } = event.data;
    if (type === 'init' || !text) {
        // Just triggering warmup
        try {
            await PipelineSingleton.getInstance(x => self.postMessage(x));
        } catch (err) {
            self.postMessage({ status: 'error', error: err.message });
        }
        return;
    }
    
    try {
        let extractor = await PipelineSingleton.getInstance(x => {
            self.postMessage(x);
        });

        // The e5 models require 'query: ' prefix for queries to perform optimally
        const formattedText = `query: ${text}`;

        let output = await extractor(formattedText, { pooling: 'mean', normalize: true });

        self.postMessage({
            status: 'complete',
            vector: Array.from(output.data)
        });
    } catch (err) {
        self.postMessage({
            status: 'error',
            error: err.message
        });
    }
});
