import { defineConfig, externalizeDepsPlugin } from 'electron-vite';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    optimizeDeps: {
      exclude: ['@huggingface/transformers', 'onnxruntime-web']
    },
    build: {
      target: 'esnext',
      minify: false,
      chunkSizeWarningLimit: 10000,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('monaco-editor')) {
              return 'monaco';
            }
          }
        }
      }
    }
  }
});
