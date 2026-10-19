import assert from 'node:assert/strict';
import { createRequire, Module } from 'node:module';
import test from 'node:test';
import { build } from 'esbuild';

// Exercise the actual Board effects and handlers with a deterministic frame clock.
// This is a component test without DOM layout; browser visual verification is separate.
const require = createRequire(import.meta.url);
const React = require('react');
const bundled = await build({ entryPoints: ['src/components/Board.tsx'], bundle: true, write: false,
  platform: 'node', format: 'cjs', jsx: 'automatic', external: ['react', 'react/jsx-runtime'],
  resolveExtensions: ['.tsx', '.ts', '.mjs', '.js', '.json'] });
const filename = new URL('../src/components/Board.tsx', import.meta.url).pathname;
const compiled = new Module(filename);
compiled.paths = Module._nodeModulePaths(process.cwd());
compiled._compile(bundled.outputFiles[0].text, filename);
const { Board } = compiled.exports;

function visit(node, callback) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { node.forEach((child) => visit(child, callback)); return; }
  callback(node);
  visit(node.props?.children, callback);
}

function environment(t) {
  const frames = new Map();
  let now = 0, nextFrameId = 0;
  class Element {
    listeners = new Map();
    addEventListener(name, handler) {
      if (!this.listeners.has(name)) this.listeners.set(name, new Set());
      this.listeners.get(name).add(handler);
    }
    removeEventListener(name, handler) { this.listeners.get(name)?.delete(handler); }
    dispatch(name, event) { [...(this.listeners.get(name) ?? [])].forEach((handler) => handler(event)); }
    getBoundingClientRect() { return { left: 30, top: 30 }; }
  }
  const globals = { window: new Element(), HTMLElement: Element,
    performance: { now: () => now }, requestAnimationFrame: (callback) => {
      const id = ++nextFrameId; frames.set(id, callback); return id;
    }, cancelAnimationFrame: (id) => frames.delete(id),
    ResizeObserver: class {
      constructor(callback) { this.callback = callback; }
      observe(node) { this.callback([{ contentRect: node.size }]); }
      disconnect() {}
    } };
  const restoreGlobals = [];
  const boards = [];
  t.after(() => { boards.forEach((board) => board.dispose()); restoreGlobals.reverse().forEach((restore) => restore()); });
  for (const [key, value] of Object.entries(globals)) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    restoreGlobals.push(() => descriptor ? Object.defineProperty(globalThis, key, descriptor) : delete globalThis[key]);
  }

  function mount(props = {}, size = { width: 510, height: 414 }) {
    const shell = new Element(); shell.size = size;
    const stage = new Element();
    const slots = [];
    let cursor = 0, dirty = true, tree;
    const effects = [];
    const state = { sceneId: 'scene-a', tokens: [], zoom: 1, selectedTokenIds: [], focusRequest: null,
      followTokenId: 'pg', dimensions: { columns: 100, rows: 100 }, diagonalRule: 'standard',
      measurementUnit: { label: 'm', cellsValue: 1.5 }, ...props };
    const changed = (before, after) => !before || !after || before.length !== after.length
      || after.some((value, index) => !Object.is(before[index], value));
    const dispatcher = {
      useState(initial) {
        const index = cursor++;
        if (!slots[index]) slots[index] = { value: typeof initial === 'function' ? initial() : initial };
        const slot = slots[index];
        slot.setter ??= (value) => {
          const next = typeof value === 'function' ? value(slot.value) : value;
          if (!Object.is(next, slot.value)) { slot.value = next; dirty = true; }
        };
        return [slot.value, slot.setter];
      },
      useRef(initial) { const index = cursor++; return (slots[index] ??= { current: initial }); },
      useMemo(compute, deps) {
        const index = cursor++;
        if (changed(slots[index]?.deps, deps)) slots[index] = { deps, value: compute() };
        return slots[index].value;
      },
      useEffect(effect, deps) {
        const index = cursor++;
        if (changed(slots[index]?.deps, deps)) {
          const previous = slots[index];
          const slot = slots[index] = { deps };
          effects.push(() => { previous?.cleanup?.(); slot.cleanup = effect(); });
        }
      },
    };
    const board = {
      flush() {
        for (let pass = 0; dirty; pass++) {
          assert.ok(pass < 30, 'Board effects converge'); dirty = false; cursor = 0;
          const hook = React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher;
          const previous = hook.current; hook.current = dispatcher;
          try { tree = Board(state); } finally { hook.current = previous; }
          visit(tree, (node) => {
            if (node.ref && typeof node.ref === 'object') {
              node.ref.current = node.props.className?.startsWith('board-shell') ? shell : stage;
            }
          });
          effects.splice(0).forEach((effect) => effect());
        }
      },
      update(props) { Object.assign(state, props); dirty = true; this.flush(); },
      camera() {
        let camera;
        visit(tree, (node) => {
          if (node.props?.className?.startsWith('board-shell')) {
            camera = { x: node.props['data-camera-x'], y: node.props['data-camera-y'] };
          }
        });
        return camera;
      },
      token(id) {
        let result;
        visit(tree, (node) => { if (node.type?.name === 'Token' && node.props.token.id === id) result = node.props; });
        return result;
      },
      pan(dx, dy) {
        let handler;
        visit(tree, (node) => { if (node.props?.className === 'board-stage board-stage--virtual') handler = node.props.onPointerDown; });
        const event = { button: 1, pointerId: 1, clientX: 100, clientY: 100, preventDefault() {}, stopPropagation() {}, target: stage, currentTarget: stage };
        handler(event); this.flush();
        assert.ok(window.listeners.get('pointermove')?.size > 0, 'pan installs a pointermove listener');
        window.dispatch('pointermove', { ...event, clientX: 100 - dx * 48, clientY: 100 - dy * 48 });
        this.flush(); window.dispatch('pointerup', event); this.flush();
      },
      dispose() { slots.forEach((slot) => slot?.cleanup?.()); },
    };
    boards.push(board); board.flush(); return board;
  }
  return { mount, frame(time) {
    now = time; const callbacks = [...frames.values()]; frames.clear();
    callbacks.forEach((callback) => callback(now)); boards.forEach((board) => board.flush());
  } };
}

const pg = (x, y, id = 'pg') => ({ id, name: id, type: 'player', size: 'medium', position: { x, y },
  color: '#ffffff', initiativeModifier: 0, conditions: [] });
const walk = (id, from, to, tokenId = 'pg', sceneId = 'scene-a') =>
  ({ id, tokenId, sceneId, waypoints: [from, to], showTrack: true });

test('optimistic destinations do not move the camera; confirmed walking follows interpolation and finishes once', (t) => {
  const env = environment(t), board = env.mount({ tokens: [pg(5, 5)] });
  board.update({ tokens: [pg(5, 25)] }); // optimistic request / rollback without token-walk
  env.frame(100);
  assert.deepEqual(board.camera(), { x: 0, y: 0 });
  board.update({ tokens: [pg(5, 5)] });
  board.update({ tokens: [pg(5, 25)], tokenWalkEvents: [walk('walk-1', { x: 5, y: 5 }, { x: 5, y: 25 })] });
  assert.deepEqual(board.camera(), { x: 0, y: 0 });
  env.frame(725); // quarter of the 2500ms animation, from time 100
  assert.deepEqual(board.camera(), { x: 0, y: 3 });
  assert.equal(board.token('pg').displayPosition.y, 7);
  env.frame(2600);
  assert.deepEqual(board.camera(), { x: 0, y: 18 });
  board.pan(0, -10);
  assert.deepEqual(board.camera(), { x: 0, y: 8 });
  board.update({ tokens: [{ ...pg(5, 25), hitPoints: 3 }] }); env.frame(3000);
  assert.deepEqual(board.camera(), { x: 0, y: 8 });
});

test('localize consumes its nonce and does not override subsequent manual pan or unrelated updates', (t) => {
  const env = environment(t), board = env.mount({ tokens: [pg(50, 50)] });
  board.update({ focusRequest: { tokenId: 'pg', nonce: 1 } });
  assert.deepEqual(board.camera(), { x: 46, y: 47 });
  board.pan(-5, -5); const manual = board.camera();
  board.update({ tokens: [{ ...pg(50, 50), hitPoints: 4 }, pg(80, 80, 'other')] });
  env.frame(100);
  assert.deepEqual(board.camera(), manual);
  board.update({ focusRequest: { tokenId: 'pg', nonce: 2 } });
  assert.deepEqual(board.camera(), { x: 46, y: 47 });
});

test('deduplicates deliveries, rejects old-scene events and resets on transition', (t) => {
  const env = environment(t), event = walk('once', { x: 5, y: 5 }, { x: 5, y: 25 });
  const board = env.mount({ tokens: [pg(5, 25)], tokenWalkEvents: [event] });
  env.frame(5000); // history supplied at mount is not replayed
  assert.deepEqual(board.camera(), { x: 0, y: 0 });
  board.update({ tokenWalkEvents: [{ ...event }] }); env.frame(5100);
  assert.deepEqual(board.camera(), { x: 0, y: 0 });
  board.update({ tokenWalkEvents: [walk('new', { x: 5, y: 5 }, { x: 5, y: 25 })] });
  env.frame(7600); assert.equal(board.camera().y, 18);
  board.update({ sceneId: 'scene-b', tokens: [pg(5, 5)] });
  board.update({ tokenWalkEvents: [walk('late', { x: 5, y: 5 }, { x: 5, y: 80 })] });
  env.frame(10000); assert.deepEqual(board.camera(), { x: 0, y: 0 });
});

test('independent viewports follow only their PG, including the passenger seat during a vehicle walk', (t) => {
  const env = environment(t);
  const vehicle = { ...pg(20, 25, 'vehicle'), type: 'vehicle', vehicleOccupantIds: ['pg'] };
  const passenger = { ...pg(21, 26), containedInVehicleId: 'vehicle' };
  const tokens = [passenger, vehicle, pg(2, 2, 'other')];
  const first = env.mount({ tokens });
  const second = env.mount({ tokens, followTokenId: 'other' });
  const fullscreen = env.mount({ tokens, isFullscreen: true }, { width: 750, height: 798 });
  const event = walk('vehicle-walk', { x: 2, y: 5 }, { x: 20, y: 25 }, 'vehicle');
  for (const board of [first, second, fullscreen]) board.update({ tokenWalkEvents: [event] });
  env.frame(1250);
  assert.ok(first.camera().y > 0);
  assert.deepEqual(second.camera(), { x: 0, y: 0 });
  assert.ok(fullscreen.camera().y < first.camera().y);
  const display = first.token('pg').displayPosition;
  assert.ok(display.x >= 0 && display.x + 1 <= 10);
  assert.ok(display.y >= 0 && display.y + 1 <= 8);
  const camera = first.camera();
  first.update({ followTokenId: null }); env.frame(2500);
  assert.deepEqual(first.camera(), camera);
});

test('all four edges work with finite/unlimited scenes, zoom and different panel widths', (t) => {
  const env = environment(t);
  let time = 0, id = 0;
  for (const dimensions of [{ columns: 100, rows: 100 }, { columns: 0, rows: 0 }]) {
    for (const zoom of [0.5, 1, 2]) {
      for (const width of [510, 750]) {
        const board = env.mount({ tokens: [pg(50, 50)], dimensions, zoom }, { width, height: 414 });
        for (const position of [{ x: 80, y: 50 }, { x: 80, y: 80 }, { x: 20, y: 80 }, { x: 20, y: 20 }]) {
          const from = { x: 50, y: 50 };
          board.update({ tokens: [pg(position.x, position.y)],
            tokenWalkEvents: [walk(`edge-${++id}`, from, position)] });
          time += 3000; env.frame(time);
          const display = board.token('pg').displayPosition;
          assert.ok(display.x >= 0 && display.x + 1 <= (width - 30) / (48 * zoom));
          assert.ok(display.y >= 0 && display.y + 1 <= 384 / (48 * zoom));
        }
      }
    }
  }
});

test('a confirmed single keyboard/pad step follows the PG without drawing a path track', (t) => {
  const env = environment(t), board = env.mount({ tokens: [pg(5, 7)] });
  const event = { ...walk('single-step', { x: 5, y: 7 }, { x: 5, y: 8 }), showTrack: false };
  board.update({ tokens: [pg(5, 8)], tokenWalkEvents: [event] });
  env.frame(150);
  assert.deepEqual(board.camera(), { x: 0, y: 0.5 });
  assert.equal(board.token('pg').displayPosition.y, 7);
  env.frame(300);
  assert.deepEqual(board.camera(), { x: 0, y: 1 });
});
