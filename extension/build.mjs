import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(new URL('../frontend/package.json',import.meta.url));
const {build}=require('esbuild');
await build({entryPoints:[fileURLToPath(new URL('content-entry.js',import.meta.url))],outfile:fileURLToPath(new URL('content.js',import.meta.url)),bundle:true,format:'iife',target:'chrome120',legalComments:'inline'});
console.log('Gmail content script bundled.');
