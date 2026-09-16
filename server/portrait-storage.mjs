import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const MAX_PORTRAIT_BYTES = 5 * 1024 * 1024;
const extensionByMediaType = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function detectMediaType(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return null;
}

export class PortraitStorage {
  constructor(root) {
    this.root = path.resolve(root);
  }

  async initialize() {
    await mkdir(this.root, { recursive: true });
    const names = await readdir(this.root);
    await Promise.all(names.filter((name) => name.startsWith('.tmp-')).map((name) => rm(path.join(this.root, name), { force: true })));
  }

  async stage(buffer, declaredMediaType) {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0 || buffer.length > MAX_PORTRAIT_BYTES) {
      throw new TypeError('Il ritratto deve essere un file non vuoto di massimo 5 MB.');
    }
    const detectedMediaType = detectMediaType(buffer);
    if (!detectedMediaType || detectedMediaType !== declaredMediaType || !extensionByMediaType[declaredMediaType]) {
      throw new TypeError('Tipo o firma del ritratto non validi. Usa JPEG, PNG o WebP.');
    }
    await mkdir(this.root, { recursive: true });
    const nonce = randomUUID();
    const temporaryName = `.tmp-${nonce}`;
    const fileName = `${nonce}.${extensionByMediaType[declaredMediaType]}`;
    const temporaryPath = path.join(this.root, temporaryName);
    await writeFile(temporaryPath, buffer, { flag: 'wx' });
    try {
      await rename(temporaryPath, path.join(this.root, fileName));
    } catch (error) {
      await rm(temporaryPath, { force: true });
      throw error;
    }
    return { fileName, mediaType: detectedMediaType, updatedAt: new Date().toISOString() };
  }

  resolve(fileName) {
    if (typeof fileName !== 'string' || !/^[a-f0-9-]{36}\.(?:jpg|png|webp)$/.test(fileName)) throw new TypeError('Nome ritratto non valido.');
    const resolved = path.resolve(this.root, fileName);
    if (path.dirname(resolved) !== this.root) throw new TypeError('Percorso ritratto non valido.');
    return resolved;
  }

  open(fileName) { return createReadStream(this.resolve(fileName)); }
  async remove(fileName) { if (fileName) await rm(this.resolve(fileName), { force: true }); }
}
