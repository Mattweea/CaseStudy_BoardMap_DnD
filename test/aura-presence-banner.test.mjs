import assert from 'node:assert/strict';
import { createRequire, Module } from 'node:module';
import test from 'node:test';
import { build } from 'esbuild';

const require = createRequire(import.meta.url), React = require('react');
const filename = new URL('../src/components/AuraPresenceBanner.tsx', import.meta.url).pathname;
const bundled = await build({ entryPoints: [filename], bundle: true, write: false, platform: 'node', format: 'cjs',
  jsx: 'automatic', external: ['react', 'react/jsx-runtime', 'react-dom'],
  resolveExtensions: ['.tsx', '.ts', '.mjs', '.js', '.json'] });
const compiled = new Module(filename); compiled.paths = Module._nodeModulePaths(process.cwd());
compiled._compile(bundled.outputFiles[0].text, filename);
const { AuraPresenceBanner } = compiled.exports;

const aura = (id) => ({ id, name: `Aura ${id}`, effect: `Effetto ${id}`, radiusCells: 3, active: true });
const owner = { id: 'hunter', name: 'Hunter', ownerUserId: 'hunter-user', position: { x: 5, y: 5 },
  auras: [aura('a'), aura('b'), aura('c')] };
const hero = { id: 'hero', name: 'Sylas', ownerUserId: 'sylas-user', position: { x: 5, y: 5 } };
const initialState = { activeSceneId: 'scene-a', tokens: [owner, hero] };

function visit(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(child => visit(child, predicate));
  return [...(predicate(node) ? [node] : []), ...visit(node.props?.children ?? node.children, predicate)];
}

function mount(patch = {}) {
  const slots = [], effects = [];
  let cursor = 0, dirty = true, tree, focusCount = 0;
  const props = { host: { nodeType: 1, id: 'normal' }, state: initialState, userId: 'sylas-user', ...patch };
  const changed = (before, after) => !before || !after || after.some((entry, index) => !Object.is(entry, before[index]));
  const hooks = {
    useState(initial) {
      const index = cursor++, slot = slots[index] ??= { value: typeof initial === 'function' ? initial() : initial };
      slot.setter ??= (value) => {
        const next = typeof value === 'function' ? value(slot.value) : value;
        if (!Object.is(next, slot.value)) { slot.value = next; dirty = true; }
      };
      return [slot.value, slot.setter];
    },
    useRef(initial) { return slots[cursor++] ??= { current: initial }; },
    useId() { return hooks.useRef('aura-panel').current; },
    useEffect(effect, deps) {
      const index = cursor++, previous = slots[index];
      if (changed(previous?.deps, deps)) {
        const slot = slots[index] = { deps };
        effects.push(() => { previous?.cleanup?.(); slot.cleanup = effect(); });
      }
    },
  };
  const ui = {
    flush() {
      for (let pass = 0; dirty; pass++) {
        assert.ok(pass < 25); dirty = false; cursor = 0;
        const dispatcher = React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher;
        const previous = dispatcher.current; dispatcher.current = hooks;
        try { tree = AuraPresenceBanner(props); } finally { dispatcher.current = previous; }
        visit(tree, node => node.ref && typeof node.ref === 'object').forEach(node => {
          node.ref.current = { focus: () => { focusCount++; } };
        });
        effects.splice(0).forEach(effect => effect());
      }
    },
    update(patch) { Object.assign(props, patch); dirty = true; this.flush(); },
    find(predicate) { return visit(tree, predicate); },
    toggle() { return this.find(node => node.props?.className?.includes('aura-presence-banner__toggle'))[0]; },
    click(node) { node.props.onClick(); this.flush(); },
    get tree() { return tree; }, get focusCount() { return focusCount; },
  };
  ui.flush(); return ui;
}

test('multiple auras start collapsed with a counter and an accessible announcement', () => {
  const ui = mount();
  assert.equal(ui.toggle().props['aria-expanded'], false);
  assert.equal(ui.toggle().props['aria-label'], 'Aure applicate: 3');
  assert.equal(ui.find(node => node.type === 'ul').length, 0);
  assert.match(ui.find(node => node.props?.role === 'status')[0].props.children, /Hunter: Aura a/);
  ui.update({ state: { ...initialState, tokens: [{ ...owner, auras: [...owner.auras, aura('d')] }, hero] } });
  assert.equal(ui.toggle().props['aria-label'], 'Aure applicate: 4');
  assert.equal(ui.toggle().props['aria-expanded'], false);
  assert.match(ui.find(node => node.props?.role === 'status')[0].props.children, /Aura d/);
});

test('the disclosure preserves row details and Escape closes it with focus on the toggle', () => {
  const ui = mount(); ui.click(ui.toggle());
  const list = ui.find(node => node.type === 'ul')[0];
  assert.equal(list.props.id, ui.toggle().props['aria-controls']);
  assert.equal(ui.find(node => node.type === 'li').length, 3);
  ui.click(ui.find(node => node.props?.className === 'aura-presence-banner__row')[0]);
  assert.equal(ui.find(node => node.props?.className === 'aura-presence-banner__effect')[0].props.children, 'Effetto a');
  let stopped = 0, prevented = 0;
  const wrapper = ui.find(node => node.type === 'div')[0];
  wrapper.props.onKeyDown({ key: 'Escape', stopPropagation: () => stopped++, preventDefault: () => prevented++ });
  ui.flush();
  assert.equal(ui.toggle().props['aria-expanded'], false);
  assert.equal(ui.focusCount, 1); assert.equal(stopped, 1); assert.equal(prevented, 1);
});

test('leaving all auras and changing scene reset the disclosure; host changes keep it in the active map', () => {
  const ui = mount(); ui.click(ui.toggle());
  const fullscreen = { nodeType: 1, id: 'fullscreen' };
  ui.update({ host: fullscreen });
  assert.equal(ui.tree.containerInfo, fullscreen);
  assert.equal(ui.toggle().props['aria-expanded'], true);
  ui.update({ state: { ...initialState, tokens: [hero] } }); assert.equal(ui.tree, null);
  ui.update({ state: initialState }); assert.equal(ui.toggle().props['aria-expanded'], false);
  ui.click(ui.toggle());
  ui.update({ state: { ...initialState, activeSceneId: 'scene-b' } });
  assert.equal(ui.toggle().props['aria-expanded'], false);
});

test('removed aura details disappear and own/master/sanitized-away owners produce no panel', () => {
  const ui = mount(); ui.click(ui.toggle());
  ui.click(ui.find(node => node.props?.className === 'aura-presence-banner__row')[0]);
  ui.update({ state: { ...initialState, tokens: [{ ...owner, auras: [aura('b')] }, hero] } });
  assert.equal(ui.find(node => node.props?.className === 'aura-presence-banner__effect').length, 0);
  assert.equal(ui.toggle().props['aria-label'], 'Aure applicate: 1');
  ui.update({ userId: 'hunter-user' }); assert.equal(ui.tree, null);
  ui.update({ userId: 'master-user' }); assert.equal(ui.tree, null);
  ui.update({ userId: 'sylas-user', state: { ...initialState, tokens: [hero] } }); assert.equal(ui.tree, null);
});
