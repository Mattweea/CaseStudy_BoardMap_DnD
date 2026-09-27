import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { MAX_SCENE_BACKGROUND_BYTES, SceneBackgroundStorage } from '../server/scene-background-storage.mjs';

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

test('scene background storage stages valid assets and cleans abandoned temporary files', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'vtt-scene-background-'));
  const storage = new SceneBackgroundStorage(directory);
  try {
    writeFileSync(join(directory, '.tmp-orphan'), 'orphan');
    await storage.initialize();
    assert.equal(existsSync(join(directory, '.tmp-orphan')), false);
    const stored = await storage.stage(png, 'image/png');
    assert.equal(stored.kind, 'image');
    assert.equal(stored.byteLength, png.length);
    assert.match(stored.assetId, /^[a-f0-9-]{36}$/);
    assert.match(stored.etag, /^[a-f0-9]{64}$/);
    assert.ok(existsSync(storage.resolve(stored)));
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('scene background storage rejects empty, oversized, mismatched and unsafe inputs without residue', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'vtt-scene-background-invalid-'));
  const storage = new SceneBackgroundStorage(directory);
  try {
    await storage.initialize();
    await assert.rejects(storage.stage(Buffer.alloc(0), 'image/png'), /non vuoto/);
    await assert.rejects(storage.stage(Buffer.alloc(MAX_SCENE_BACKGROUND_BYTES + 1), 'image/png'), /10 MB/);
    await assert.rejects(storage.stage(png, 'image/jpeg'), /firma/);
    assert.throws(() => storage.resolve({ assetId: '../escape', mediaType: 'image/png' }), /Metadati/);
    assert.deepEqual(readdirSync(directory), []);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
