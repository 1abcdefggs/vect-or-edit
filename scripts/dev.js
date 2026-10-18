import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Some Electron-based hosts leave ELECTRON_RUN_AS_NODE=1 in the environment.
// Inherited by the dev process, it makes the Electron app start as plain Node and fail.
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const electronVite = fileURLToPath(new URL('../node_modules/electron-vite/bin/electron-vite.js', import.meta.url));
const child = spawn(process.execPath, [electronVite, 'dev', ...process.argv.slice(2)], { stdio: 'inherit', env });
child.on('exit', (code) => process.exit(code ?? 1));
