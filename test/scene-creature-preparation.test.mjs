import assert from 'node:assert/strict';
import { createRequire, Module } from 'node:module';
import test from 'node:test';
import { build } from 'esbuild';
import { renderToStaticMarkup } from 'react-dom/server';
import { createDefaultSceneDocument } from '../shared/scene-model.mjs';

const require = createRequire(import.meta.url);
const React = require('react');
async function component(path) {
  const filename = new URL(path, import.meta.url).pathname;
  const bundled = await build({ entryPoints: [filename], bundle: true, write: false, platform: 'node', format: 'cjs',
    jsx: 'automatic', external: ['react', 'react/jsx-runtime', 'react-dom'],
    resolveExtensions: ['.tsx', '.ts', '.mjs', '.js', '.json'] });
  const loaded = new Module(filename); loaded.paths = Module._nodeModulePaths(process.cwd());
  loaded._compile(bundled.outputFiles[0].text, filename);
  return loaded.exports;
}
const { SceneCreaturePreparationSection: Editor } = await component('../src/components/SceneCreaturePreparationSection.tsx');
const { SceneWizardNavigation, SCENE_STEPS } = await component('../src/components/SceneWizardNavigation.tsx');
const { useSceneDraft } = await component('../src/components/SceneDraftContext.tsx');
const scene = { id: 'scene', version: 1, document: { ...createDefaultSceneDocument(),
  encounters: [{ id: 'a', name: 'Portone', kind: 'combat' }, { id: 'b', name: 'Locanda', kind: 'narrative' }],
  entityReferences: [
    { id: 'goblin', encounterId: 'a', entityId: 'goblin', entityType: 'monster', name: 'Goblin del portone' },
    { id: 'guard', encounterId: 'a', entityId: 'guard', entityType: 'npc', name: 'Guardia del portone' },
    { id: 'host', encounterId: 'b', entityId: 'host', entityType: 'npc', name: 'Oste della locanda' },
  ], preparedPlacements: [{ id: 'guard-1', encounterId: 'a', entityReferenceId: 'guard', position: { x: 2, y: 2 } }],
} };
const props = { scene, encounterId: null, disabled: false, error: null,
  placementPreview: { host: null, width: 0, height: 0, left: 0, top: 0, interactive: false },
  onSelectEncounter() {}, onGoToEncounters() {}, onCreateEntity() {}, onUpdateEntity() {},
  onCreatePlacement() {}, onUpdatePlacement() {}, onRemovePlacement() {},
};
const render = (patch = {}) => renderToStaticMarkup(React.createElement(Editor, { ...props, ...patch }));
function find(node, type) {
  if (!node || typeof node !== 'object') return undefined;
  if (Array.isArray(node)) return node.map((child) => find(child, type)).find(Boolean);
  return node.type === type ? node : find(node.props?.children, type);
}

test('wizard navigation exposes six ordered steps and a separately selectable creature step', () => {
  assert.deepEqual(SCENE_STEPS, ['Base', 'Pareti e ambiente', 'Luci e visuale', 'Encounter', 'Mostri e PNG', 'Riepilogo']);
  const chosen = [];
  const tree = SceneWizardNavigation({ step: 4, disabled: false, onSelect: (index) => chosen.push(index) });
  const items = tree.props.children.props.children;
  assert.equal(items.length, 6);
  assert.equal(items[4].props.children.props['aria-current'], 'step');
  items[5].props.children.props.onClick();
  assert.deepEqual(chosen, [5]);
});

test('a scene without encounters offers a return and no figure mutation form', () => {
  const html = render({ scene: { ...scene, document: { ...scene.document, encounters: [] } } });
  assert.match(html, /Vai a Encounter/);
  assert.match(html, /continua al riepilogo/);
  assert.doesNotMatch(html, /<form|Aggiungi figura/);
});

test('an explicit valid selection is required before rendering creature forms', () => {
  for (const encounterId of [null, 'removed']) {
    const html = render({ encounterId });
    assert.match(html, /Scegli un encounter/);
    assert.match(html, /Portone/); assert.match(html, /Locanda/);
    assert.doesNotMatch(html, /<form|Goblin del portone|Oste della locanda/);
  }
});

test('existing monster, NPC and placement editors receive only the chosen encounter', () => {
  const first = render({ encounterId: 'a' });
  assert.match(first, /Goblin del portone/); assert.match(first, /Guardia del portone/);
  assert.doesNotMatch(first, /Oste della locanda/);
  assert.match(first, /Aggiungi figura/); assert.match(first, /Quantità/);
  const second = render({ encounterId: 'b' });
  assert.match(second, /Oste della locanda/);
  assert.doesNotMatch(second, /Goblin del portone|Guardia del portone/);
});

test('selection is controlled by the parent so its draft guard runs before changing context', () => {
  const selected = [];
  const tree = Editor({ ...props, encounterId: 'a', onSelectEncounter: (id) => selected.push(id) });
  const selector = find(tree, 'select');
  selector.props.onChange({ target: { value: 'b' } });
  assert.deepEqual(selected, ['b']);
  assert.equal(selector.props.value, 'a', 'selection stays unchanged until the parent accepts the change');
});

test('draft registration and cleanup are available before a subsequent encounter selection', () => {
  const drafts = new Map(), layouts = [], passive = [];
  const registry = { register: (id, draft) => draft ? drafts.set(id, draft) : drafts.delete(id) };
  const cleanups = [];
  const dispatcher = {
    useContext: () => registry, useId: () => 'figure-a',
    useLayoutEffect(effect, deps) {
      if (!deps || !cleanups.length) layouts.push(() => { const cleanup = effect(); if (cleanup) cleanups.push(cleanup); });
    },
    useEffect: (effect) => passive.push(effect),
  };
  const renderDraft = (dirty, save) => {
    const hook = React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher;
    const previous = hook.current; hook.current = dispatcher;
    try { useSceneDraft(dirty, save, () => {}); } finally { hook.current = previous; }
    layouts.splice(0).forEach(effect => effect());
  };
  const saveInA = async () => true;
  renderDraft(true, saveInA);
  assert.equal(drafts.get('figure-a').save, saveInA, 'guard sees the original destination before passive effects');
  renderDraft(false, saveInA);
  assert.equal(drafts.size, 0, 'discarded draft cannot cause an unnecessary second leave prompt');
  renderDraft(true, saveInA);
  cleanups.forEach(cleanup => cleanup());
  assert.equal(drafts.size, 0, 'unmount removes the old editor before mounting the next encounter');
  assert.equal(passive.length, 0);
});
