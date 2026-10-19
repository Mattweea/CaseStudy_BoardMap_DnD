import assert from 'node:assert/strict';
import { createRequire, Module } from 'node:module';
import test from 'node:test';
import { build } from 'esbuild';
import { createDefaultSceneDocument } from '../shared/scene-model.mjs';

const require = createRequire(import.meta.url), React = require('react');
const filename = new URL('../src/components/SceneEncounterPlacementSection.tsx', import.meta.url).pathname;
const bundled = await build({ entryPoints: [filename], bundle: true, write: false, platform: 'node', format: 'cjs',
  jsx: 'automatic', external: ['react', 'react/jsx-runtime', 'react-dom'], resolveExtensions: ['.tsx', '.ts', '.mjs', '.js'] });
const loaded = new Module(filename); loaded.paths = Module._nodeModulePaths(process.cwd());
loaded._compile(bundled.outputFiles[0].text, filename);
const Editor = loaded.exports.SceneEncounterPlacementSection;

function find(node, predicate) {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) return node.map((child) => find(child, predicate)).find(Boolean);
  return predicate(node) ? node : find(node.props?.children ?? node.children, predicate);
}

function editor(t, options = {}) {
  const previousWindow = globalThis.window;
  globalThis.window = { addEventListener() {}, removeEventListener() {} };
  t.after(() => { if (previousWindow) globalThis.window = previousWindow; else delete globalThis.window; });
  const entity = { id: 'ref', entityId: 'definition', entityType: 'monster', encounterId: 'enc', name: 'Goblin' };
  const scene = { id: 'scene', version: 1, document: { ...createDefaultSceneDocument(), entityReferences: [entity],
    encounters: [{ id: 'enc', name: 'Incontro', kind: 'combat' }], preparedPlacements: options.placements ?? [] } };
  const calls = [];
  const props = { scene, encounterId: 'enc', disabled: false,
    preview: { host: { nodeType: 1, getBoundingClientRect: () => ({ left: 100, top: 50, width: 600, height: 400 }) },
      left: 240, top: 96, width: 1200, height: 800, interactive: true, onBeginEdit() {} },
    onCreatePlacement: async (...args) => { calls.push(['create', ...args]); return true; },
    onUpdatePlacement: async (...args) => { calls.push(['update', ...args]); return options.accept !== false; },
    onRemovePlacement: async (...args) => { calls.push(['remove', ...args]); return true; },
  };
  const slots = []; let cursor = 0, tree, dirty = true;
  const effects = [];
  const hooks = {
    useState(initial) {
      const i = cursor++; slots[i] ??= { value: initial };
      return [slots[i].value, (value) => { const next = typeof value === 'function' ? value(slots[i].value) : value;
        if (!Object.is(next, slots[i].value)) { slots[i].value = next; dirty = true; } }];
    },
    useRef(initial) { return slots[cursor++] ??= { current: initial }; },
    useEffect(effect, deps) {
      const i = cursor++, previous = slots[i];
      if (!previous || deps.some((dep, index) => !Object.is(dep, previous.deps[index]))) {
        slots[i] = { deps }; effects.push(() => { previous?.cleanup?.(); slots[i].cleanup = effect(); });
      }
    },
  };
  function flush() {
    for (let pass = 0; dirty; pass++) {
      assert.ok(pass < 20); dirty = false; cursor = 0;
      const dispatcher = React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher;
      const previous = dispatcher.current; dispatcher.current = hooks;
      try { tree = Editor(props); } finally { dispatcher.current = previous; }
      effects.splice(0).forEach((effect) => effect());
    }
  }
  flush();
  return { calls, flush, props,
    find: (predicate) => find(tree, predicate),
    update: (patch) => { Object.assign(props, patch); dirty = true; flush(); },
    field: (text) => {
      const label = find(tree, (node) => node.type === 'label' && node.props.children[0] === text);
      return label.props.children.find((child) => child && typeof child === 'object');
    },
  };
}

test('placement form sends entity, zero-based position, geometry and hidden state without scenic fields', async (t) => {
  const ui = editor(t);
  ui.field('Figura').props.onChange({ target: { value: 'ref' } }); ui.flush();
  for (const [label, value] of [['Colonna', '4'], ['Riga', '5'], ['Larghezza in caselle', '2']]) {
    ui.field(label).props.onChange({ target: { value } }); ui.flush();
  }
  await ui.find((node) => node.type === 'form').props.onSubmit({ preventDefault() {} }); ui.flush();
  assert.deepEqual(ui.calls[0], ['create', 'enc', { entityReferenceId: 'ref', position: { x: 3, y: 4 },
    widthCells: 2, heightCells: null, isHidden: false }]);
  assert.equal(Boolean(ui.find((node) => node.props?.children === 'Ruota')), false);
  assert.equal(Boolean(ui.find((node) => node.props?.children === 'Blocca visuale')), false);
});

test('dragging a placement uses the transformed preview and persists one move per completed gesture', async (t) => {
  const ui = editor(t, { placements: [{ id: 'place', encounterId: 'enc', entityReferenceId: 'ref', position: { x: 10, y: 8 } }] });
  let token = ui.find((node) => node.props?.['aria-label'] === 'Collocazione Goblin');
  const start = { button: 0, pointerId: 1, clientX: 220, clientY: 194,
    currentTarget: { setPointerCapture() {} }, preventDefault() {}, stopPropagation() {} };
  token.props.onPointerDown(start); ui.flush();
  token = ui.find((node) => node.props?.['aria-label'] === 'Collocazione Goblin');
  token.props.onPointerMove({ ...start, clientX: 244, clientY: 218 });
  assert.equal(ui.calls.length, 0);
  await token.props.onPointerUp(start); ui.flush();
  assert.equal(ui.calls.length, 1);
  assert.deepEqual(ui.calls[0].slice(0, 3), ['update', 'enc', 'place']);
  assert.deepEqual(ui.calls[0][3].position, { x: 11, y: 9 });
  // Server props remain the source after either success or rejection; no pending gesture survives.
  assert.equal(ui.find((node) => node.props?.['aria-label'] === 'Collocazione Goblin').props.style.left, '20%');
});

test('pan/drawing modes prevent placement gestures and cancellation sends no mutation', async (t) => {
  const ui = editor(t, { placements: [{ id: 'place', encounterId: 'enc', entityReferenceId: 'ref', position: { x: 10, y: 8 } }] });
  ui.update({ preview: { ...ui.props.preview, interactive: false } });
  assert.equal(ui.find((node) => node.props?.['aria-label'] === 'Collocazione Goblin').props.disabled, true);
  ui.update({ preview: { ...ui.props.preview, interactive: true } });
  const token = ui.find((node) => node.props?.['aria-label'] === 'Collocazione Goblin');
  const event = { button: 0, pointerId: 1, clientX: 220, clientY: 194,
    currentTarget: { setPointerCapture() {} }, preventDefault() {}, stopPropagation() {} };
  token.props.onPointerDown(event); token.props.onPointerMove({ ...event, clientX: 244 });
  token.props.onPointerCancel(); await token.props.onPointerUp(event); ui.flush();
  assert.equal(ui.calls.length, 0);
});
