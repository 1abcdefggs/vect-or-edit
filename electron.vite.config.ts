import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import { resolve } from 'path';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/preload/index.ts')
        },
        output: {
          format: 'cjs',
          entryFileNames: '[name].cjs'
        }
      }
    }
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
