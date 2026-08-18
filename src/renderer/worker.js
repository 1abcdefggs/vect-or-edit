import { pipeline, env } from '@huggingface/transformers';

env.allowLocalModels = false;
env.useBrowserCache = true;

class PipelineSingleton {
    static task = 'feature-extraction';
    static model = 'Xenova/multilingual-e5-small';
    static instance = null;

    static async getInstance(progress_callback = null) {
        if (this.instance === null) {
            this.instance = await pipeline(this.task, this.model, { 
                progress_callback,
                quantized: true, // Use int8 quantized model for smaller size/faster speed
                dtype: 'q8',    // Explicitly specify int8 precision for WebAssembly device
            });
            self.postMessage({ status: 'ready' });
        }
        return this.instance;
    }
}

// Automatically warm up / load the AI model in the background on startup
PipelineSingleton.getInstance(progress => {
    self.postMessage(progress);
}).catch(err => {
    self.postMessage({ status: 'error', error: err.message });
});

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
