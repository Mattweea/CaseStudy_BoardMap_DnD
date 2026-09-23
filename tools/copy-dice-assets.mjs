import { cp, mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(projectRoot, 'node_modules/@3d-dice/dice-box-threejs/public/textures');
const destination = resolve(projectRoot, 'public/dice-box');
const texturesDestination = resolve(destination, 'textures');

await mkdir(dirname(destination), { recursive: true });
await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
await cp(source, texturesDestination, { recursive: true });

console.log('Texture DiceBox copiate in public/dice-box/textures (audio disabilitato).');
