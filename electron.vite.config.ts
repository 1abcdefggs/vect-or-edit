import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import { resolve, dirname } from 'path';
import { existsSync } from 'fs';

// Source files import "./x.js" for modules that are written as x.ts
const resolveTsForJsImports = {
  name: 'resolve-ts-for-js-imports',
  resolveId(source: string, importer?: string) {
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
};

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
    plugins: [resolveTsForJsImports],
    // Workers are bundled separately and need the same resolution (worker.js imports embeddingModels.js)
    worker: {
      plugins: () => [resolveTsForJsImports]
    },
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
