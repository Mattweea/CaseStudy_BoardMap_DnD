import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const MAX_SCENE_BACKGROUND_BYTES = 10 * 1024 * 1024;

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

export class SceneBackgroundStorage {
  constructor(root) {
    this.root = path.resolve(root);
  }

  async initialize() {
    await mkdir(this.root, { recursive: true });
    const names = await readdir(this.root);
    await Promise.all(names
      .filter((name) => name.startsWith('.tmp-'))
      .map((name) => rm(path.join(this.root, name), { force: true })));
  }

  async stage(buffer, declaredMediaType) {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0 || buffer.length > MAX_SCENE_BACKGROUND_BYTES) {
      throw new TypeError('Lo sfondo deve essere un file non vuoto di massimo 10 MB.');
    }
    const mediaType = detectMediaType(buffer);
    if (!mediaType || mediaType !== declaredMediaType || !extensionByMediaType[declaredMediaType]) {
      throw new TypeError('Tipo o firma dello sfondo non validi. Usa JPEG, PNG o WebP.');
    }

    await mkdir(this.root, { recursive: true });
    const assetId = randomUUID();
    const temporaryPath = path.join(this.root, `.tmp-${assetId}`);
    const finalPath = path.join(this.root, `${assetId}.${extensionByMediaType[mediaType]}`);
    await writeFile(temporaryPath, buffer, { flag: 'wx' });
    try {
      await rename(temporaryPath, finalPath);
    } catch (error) {
      await rm(temporaryPath, { force: true });
      throw error;
    }

    return {
      kind: 'image',
      assetId,
      mediaType,
      byteLength: buffer.length,
      etag: createHash('sha256').update(buffer).digest('hex'),
      updatedAt: new Date().toISOString(),
    };
  }

  resolve(background) {
    const extension = extensionByMediaType[background?.mediaType];
    if (typeof background?.assetId !== 'string' || !/^[a-f0-9-]{36}$/.test(background.assetId) || !extension) {
      throw new TypeError('Metadati dello sfondo non validi.');
    }
    const resolved = path.resolve(this.root, `${background.assetId}.${extension}`);
    if (path.dirname(resolved) !== this.root) throw new TypeError('Percorso dello sfondo non valido.');
    return resolved;
  }

  open(background) {
    return createReadStream(this.resolve(background));
  }

  async remove(background) {
    if (background?.kind === 'image') await rm(this.resolve(background), { force: true });
  }
}
