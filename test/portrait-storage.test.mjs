import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { PortraitStorage } from '../server/portrait-storage.mjs';

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

test('portrait storage validates signatures, generates names and cleans temporaries', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'vtt-portrait-'));
  const storage = new PortraitStorage(directory);
  try {
    writeFileSync(join(directory, '.tmp-orphan'), 'orphan');
    await storage.initialize();
    assert.equal(existsSync(join(directory, '.tmp-orphan')), false);
    const stored = await storage.stage(png, 'image/png');
    assert.match(stored.fileName, /^[a-f0-9-]{36}\.png$/);
    assert.ok(existsSync(storage.resolve(stored.fileName)));
    const before = readdirSync(directory);
    await assert.rejects(storage.stage(png, 'image/jpeg'), /firma/);
    await assert.rejects(storage.stage(Buffer.alloc(5 * 1024 * 1024 + 1), 'image/png'), /5 MB/);
    assert.deepEqual(readdirSync(directory), before);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
