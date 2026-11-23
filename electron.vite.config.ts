import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import { loadEnv, normalizePath } from 'vite';
import { resolve, dirname } from 'path';
import { existsSync, readFileSync, statSync } from 'fs';

// Versions shown in About, read from the installed packages at build time (their package.json is not importable at run time)
const packageVersion = (name: string) =>
  JSON.parse(readFileSync(resolve(__dirname, 'node_modules', name, 'package.json'), 'utf8')).version as string;

// Source files import "./x.js" for modules that are written as x.ts
const resolveTsForJsImports = {
  name: 'resolve-ts-for-js-imports',
  resolveId(source: string, importer?: string) {
    if (importer && source.endsWith('.js') && (source.startsWith('./') || source.startsWith('../'))) {
      const resolvedPath = resolve(dirname(importer), source.slice(0, -3) + '.ts');
      try {
        if (existsSync(resolvedPath)) {
          // Same id form as Vite's own resolution (forward slashes): a backslash id made a second copy of the module
          return normalizePath(resolvedPath);
        }
      } catch {
        // fallback
      }
    }
    return null;
  }
};

// On Windows a relative import can get the drive letter in a different case (c: or C:) depending on the working
// directory. Rollup then treats the same file as two modules, so one module state (such as the IPC trust state)
// is set in one copy and read from the other. Resolve every relative import to one canonical id (upper-case drive).
const canonicalWindowsIds = {
  name: 'canonical-windows-ids',
  // 'pre' so it runs before Vite's own resolver, which would otherwise answer first for extensionless imports
  enforce: 'pre' as const,
  resolveId(source: string, importer?: string) {
    if (process.platform !== 'win32' || !importer || !(source.startsWith('./') || source.startsWith('../'))) return null;
    const base = resolve(dirname(importer), source);
    for (const candidate of [base, base + '.ts', base + '.js']) {
      try {
        if (statSync(candidate).isFile()) {
          return normalizePath(candidate.replace(/^[a-z]:/, (drive) => drive.toUpperCase()));
        }
      } catch {
        // not this candidate
      }
    }
    return null;
  }
};

export default defineConfig(({ mode }) => ({
  main: {
    plugins: [externalizeDepsPlugin(), canonicalWindowsIds],
    define: {
      // core/vault/index.js reads it; a packaged app has no .env. Read from .env or the build environment
      'process.env.VECTOR_SHARED_APP_SECRET': JSON.stringify(loadEnv(mode, __dirname, 'VECTOR_SHARED_APP_SECRET').VECTOR_SHARED_APP_SECRET ?? '')
    }
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
    define: {
      __COMPONENT_VERSIONS__: JSON.stringify({
        monaco: packageVersion('monaco-editor'),
        engine: packageVersion('@1abcdefggs/vect-or-engine')
      })
    },
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
}));
