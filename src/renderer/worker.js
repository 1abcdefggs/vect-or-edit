import { pipeline, env } from '@xenova/transformers';

// Skip local model check since we are running in Electron and fetching from HuggingFace
env.allowLocalModels = false;
env.useBrowserCache = true; // Cache the model in IndexedDB

class PipelineSingleton {
    static task = 'feature-extraction';
    static model = 'Xenova/multilingual-e5-small';
    static instance = null;

    static async getInstance(progress_callback = null) {
        if (this.instance === null) {
            this.instance = pipeline(this.task, this.model, { 
                progress_callback,
                quantized: true, // Use int8 quantized model for smaller size/faster speed
            });
        }
        return this.instance;
    }
}

self.addEventListener('message', async (event) => {
    const { text } = event.data;
    
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
