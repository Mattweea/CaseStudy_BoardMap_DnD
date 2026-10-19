import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

function source(path) {
  return readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
}

test('manual encounter editor has no catalog, import or external request path', () => {
  const editor = source('../src/components/SceneEncounterEntitySection.tsx');
  const service = source('../server/scene-service.mjs');
  const model = source('../shared/scene-model.mjs');
  const properties = source('../shared/encounter-token-properties.mjs');
  for (const text of [editor, service, model, properties]) {
    assert.doesNotMatch(text, /https?:\/\/|5e\.tools|\bfetch\s*\(|\bimport\s*\(/i);
  }
  assert.doesNotMatch(editor, />\s*(?:Importa|Catalogo|Collega al catalogo)\b/i);
  const api = source('../src/utils/sceneApi.ts');
  assert.match(api, /createEncounterEntity:[\s\S]*?`\/scenes\/\$\{encodeURIComponent\(id\)\}\/encounters\//);
  assert.match(api, /updateEncounterEntity:[\s\S]*?`\/scenes\/\$\{encodeURIComponent\(id\)\}\/encounters\//);
});
