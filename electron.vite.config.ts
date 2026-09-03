import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import { resolve, dirname } from 'path';
import { existsSync } from 'fs';

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
    resolve: {
      extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json']
    },
    plugins: [
      {
        name: 'resolve-ts-for-js-imports',
        resolveId(source, importer) {
          if (importer && source.endsWith('.js') && (source.startsWith('./') || source.startsWith('../'))) {
            const resolvedPath = resolve(dirname(importer), source.slice(0, -3) + '.ts');
            try {
              if (existsSync(resolvedPath)) {
                return resolvedPath;
              }
            } catch {
              // fallback
            }
          }
          return null;
        }
      }
    ],
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
