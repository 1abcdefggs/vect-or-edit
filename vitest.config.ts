import { defineConfig } from 'vitest/config';
import { resolve, dirname } from 'path';
import { existsSync } from 'fs';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
  },
  resolve: {
    extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json'],
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
  ]
});
