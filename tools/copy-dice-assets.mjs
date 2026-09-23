import { chmod, cp, mkdir, readdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageAssets = resolve(projectRoot, 'node_modules/@3d-dice/dice-box-threejs/public');
const destination = resolve(projectRoot, 'public/dice-box');
const texturesDestination = resolve(destination, 'textures');
const soundAssets = [
  'sounds/dicehit/dicehit_plastic8.mp3',
  'sounds/dicehit/dicehit_plastic11.mp3',
  'sounds/surfaces/surface_felt7.mp3',
];

async function normalizeFileModes(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  await Promise.all(entries.map(async (entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      await normalizeFileModes(path);
    } else if (entry.isFile()) {
      await chmod(path, 0o644);
    }
  }));
}

await mkdir(dirname(destination), { recursive: true });
await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
await cp(resolve(packageAssets, 'textures'), texturesDestination, { recursive: true });
for (const asset of soundAssets) {
  const target = resolve(destination, asset);
  await mkdir(dirname(target), { recursive: true });
  await cp(resolve(packageAssets, asset), target);
}
await normalizeFileModes(destination);

console.log(`Asset DiceBox copiati: texture e ${soundAssets.length} campioni audio locali.`);
