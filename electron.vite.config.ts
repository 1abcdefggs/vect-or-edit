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
      exclude: ['@huggingface/transformers']
    },
    build: {
      target: 'esnext',
      chunkSizeWarningLimit: 3000,
      rollupOptions: {
        output: {
          manualChunks: {
            monaco: ['monaco-editor']
          }
        }
      }
    }
  }
});
