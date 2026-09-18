import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import * as esbuild from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ABILITY_KEYS, SKILL_KEYS, createAttack, createInitialCharacterSheetData, createTool } from '../server/character-sheet-schema.mjs';

// P0.5 Fase A non introduce alcun tiro: questo test verifica solo che l'insieme dei
// bersagli `data-roll-source` prodotti dalla scheda corrisponda esattamente alla tabella
// dei bersagli della Fase B in FEATURES_VTT.md, così che la fase successiva trovi gli
// ancoraggi già al loro posto e nessuno in più. Nessuna dipendenza di test nuova: il
// componente TSX viene incluso con esbuild (già presente via Vite) in un bundle ESM
// autonomo e reso a stringa con react-dom/server, entrambi già dipendenze del progetto.
async function renderComponent(entryPath, props) {
  const result = esbuild.buildSync({
    entryPoints: [entryPath],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
    jsx: 'automatic',
    resolveExtensions: ['.tsx', '.ts', '.jsx', '.mjs', '.js', '.json'],
    external: ['react', 'react-dom', 'react-dom/*'],
    absWorkingDir: process.cwd(),
    logLevel: 'silent',
  });
  // Scritto sotto il progetto, non nella cartella temporanea di sistema: Node risolve gli
  // specificatori nudi come 'react' risalendo verso node_modules a partire dal file importato.
  const directory = mkdtempSync(join(process.cwd(), 'test', '.tmp-roll-targets-'));
  const outFile = join(directory, 'bundle.mjs');
  writeFileSync(outFile, result.outputFiles[0].text);
  try {
    const module = await import(pathToFileURL(outFile).href);
    const Component = module[Object.keys(module).find((key) => typeof module[key] === 'function')];
    return renderToStaticMarkup(React.createElement(Component, props));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function rollSourcesIn(html) {
  return [...html.matchAll(/data-roll-source="([^"]*)"/g)].map((match) => match[1]);
}

test('the character tab exposes exactly the Phase B roll targets and nothing else', async () => {
  const data = createInitialCharacterSheetData();
  data.character.attacks.push(createAttack({ id: 'attack_0001', name: 'Spada corta' }));
  data.character.tools.push(createTool({ id: 'tool_0001', name: 'Arnesi da scasso' }));

  const html = await renderComponent(
    join(process.cwd(), 'src/components/character-sheet/CharacterTab.tsx'),
    { data, patch: () => {} },
  );
  const found = rollSourcesIn(html);
  assert.equal(new Set(found).size, found.length, 'nessun bersaglio duplicato');

  const expected = new Set([
    ...ABILITY_KEYS.map((key) => `ability:${key}`),
    ...ABILITY_KEYS.map((key) => `saving-throw:${key}`),
    ...SKILL_KEYS.map((key) => `skill:${key}`),
    'initiative',
    'hit-dice',
    'death-saves',
    'tool:tool_0001',
    'attack:attack_0001',
    'attack-damage:attack_0001',
  ]);
  assert.deepEqual(new Set(found), expected);
});

test('passive perception is not a roll target even though it is a computed value', async () => {
  const data = createInitialCharacterSheetData();
  const html = await renderComponent(join(process.cwd(), 'src/components/character-sheet/CharacterTab.tsx'), { data, patch: () => {} });
  assert.doesNotMatch(html, /Percezione passiva[\s\S]{0,40}data-roll-source/);
});

test('the spells tab has no roll targets: its rows are consultation-only in Phase A', async () => {
  const data = createInitialCharacterSheetData();
  data.spells.levels['1'].spells.push({ id: 'spell_0001', name: 'Scudo', status: 'known', notes: '' });
  const html = await renderComponent(join(process.cwd(), 'src/components/character-sheet/SpellsTab.tsx'), { data, patch: () => {} });
  assert.deepEqual(rollSourcesIn(html), []);
});
