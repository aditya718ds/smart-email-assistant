import { build } from 'esbuild';
import { mkdir, copyFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const destination = new URL('../backend/src/main/resources/static/', import.meta.url);
await mkdir(destination, { recursive: true });
await rm(new URL('assets', destination), { recursive: true, force: true });
await build({entryPoints: [fileURLToPath(new URL('src/main.jsx', import.meta.url))],
  bundle: true, minify: true, format: 'esm', target: ['es2022'],
  outdir: fileURLToPath(new URL('assets', destination)),
  entryNames: 'app', legalComments: 'linked'});
await copyFile(new URL('index.html', import.meta.url), new URL('index.html', destination));
await copyFile(new URL('src/styles.css', import.meta.url), new URL('styles.css', destination));
console.log('React interface built into Spring Boot static resources.');
