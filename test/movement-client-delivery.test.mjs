import assert from 'node:assert/strict';
import { createRequire, Module } from 'node:module';
import test from 'node:test';
import { build } from 'esbuild';

const require = createRequire(import.meta.url);
const React = require('react');
const bundled = await build({ entryPoints: ['src/hooks/useBattleMapState.ts'], bundle: true, write: false,
  platform: 'node', format: 'cjs', external: ['react'], define: { 'import.meta.env': '{}' },
  resolveExtensions: ['.tsx', '.ts', '.mjs', '.js', '.json'] });
const filename = new URL('../src/hooks/useBattleMapState.ts', import.meta.url).pathname;
const compiled = new Module(filename);
compiled.paths = Module._nodeModulePaths(process.cwd());
compiled._compile(bundled.outputFiles[0].text, filename);
const { useBattleMapState } = compiled.exports;

const origin = { x: 1, y: 1 }, destination = { x: 4, y: 1 };
const hero = (position = origin) => ({ id: 'hero', name: 'Hero', type: 'player', size: 'medium',
  position, color: '#fff', conditions: [], initiativeModifier: 0, movementCells: 6 });
const snapshot = (position = origin, version = 1) => ({ version,
  state: { activeSceneId: 'scene-a', activeSceneVersion: 1, tokens: [hero(position)],
    sessionMode: 'exploration', movementUsedByTokenId: {} } });
const walk = { id: 'accepted-1', sceneId: 'scene-a', tokenId: 'hero', waypoints: [origin, destination], showTrack: true };

// Drive the real shared hook with independently controlled HTTP and SSE deliveries.
async function mount(t) {
  const slots = [], effects = [], requests = [], timers = new Map();
  let cursor = 0, dirty = true, value, stream, timerId = 0;
  const changed = (previous, next) => !previous || next.some((entry, index) => !Object.is(entry, previous[index]));
  const dispatcher = {
    useState(initial) {
      const index = cursor++;
      const slot = slots[index] ??= { value: typeof initial === 'function' ? initial() : initial };
      slot.setter ??= (next) => {
        slot.value = typeof next === 'function' ? next(slot.value) : next; dirty = true;
      };
      return [slot.value, slot.setter];
    },
    useRef(initial) { return slots[cursor++] ??= { current: initial }; },
    useCallback(callback, deps) {
      const index = cursor++;
      if (changed(slots[index]?.deps, deps)) slots[index] = { deps, value: callback };
      return slots[index].value;
    },
    useEffect(effect, deps) {
      const index = cursor++;
      if (changed(slots[index]?.deps, deps)) {
        const previous = slots[index], slot = slots[index] = { deps };
        effects.push(() => { previous?.cleanup?.(); slot.cleanup = effect(); });
      }
    },
  };
  const globals = {
    window: { localStorage: { getItem: () => null, setItem() {} },
      setTimeout: (callback) => { timers.set(++timerId, callback); return timerId; },
      clearTimeout: (id) => timers.delete(id) },
    EventSource: class {
      listeners = new Map();
      constructor() { stream = this; }
      addEventListener(name, callback) { this.listeners.set(name, callback); }
      close() {}
    },
    fetch: async (url, options) => {
      if (url.endsWith('/session-status')) return { ok: true, json: async () => ({ hasSnapshot: false }) };
      if (url.endsWith('/state')) return { ok: true, json: async () => snapshot() };
      assert.ok(url.endsWith('/move'));
      return new Promise((resolve, reject) => requests.push({ body: JSON.parse(options.body), reject,
        respond: (payload, ok = true) => resolve({ ok, status: ok ? 200 : 400, json: async () => payload }) }));
    },
  };
  const restore = [];
  for (const [key, replacement] of Object.entries(globals)) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: replacement });
    restore.push(() => descriptor ? Object.defineProperty(globalThis, key, descriptor) : delete globalThis[key]);
  }
  t.mock.method(console, 'error', () => {});
  t.after(() => { slots.forEach((slot) => slot?.cleanup?.()); restore.reverse().forEach((callback) => callback()); });
  const flush = () => {
    for (let pass = 0; dirty; pass++) {
      assert.ok(pass < 30); dirty = false; cursor = 0;
      const hook = React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher;
      const previous = hook.current; hook.current = dispatcher;
      try { value = useBattleMapState(true); } finally { hook.current = previous; }
      effects.splice(0).forEach((effect) => effect());
    }
  };
  const settle = async () => { for (let i = 0; i < 12; i++) { await Promise.resolve(); flush(); } };
  flush(); await settle(); assert.ok(value.isReady);
  return { get value() { return value; }, requests, settle,
    event(event) { stream.listeners.get('token-walk')({ data: JSON.stringify(event) }); flush(); },
    snapshot(payload) { stream.onmessage({ data: JSON.stringify(payload) }); flush(); } };
}

for (const first of ['HTTP', 'SSE']) {
  test(`movement stays at origin while pending and plays once when ${first} arrives first`, async (t) => {
    const client = await mount(t);
    const pending = client.value.moveOwnedToken('hero', destination.x, destination.y, walk.waypoints);
    await client.settle();
    assert.deepEqual(client.value.state.tokens[0].position, origin);
    assert.deepEqual(client.value.state.movementUsedByTokenId, {});
    assert.equal(client.value.tokenWalkEvents.length, 0);
    const accepted = { ...snapshot(destination, 2), walk };
    if (first === 'SSE') { client.event(walk); client.snapshot(accepted); }
    client.requests[0].respond(accepted); await pending; await client.settle();
    assert.deepEqual(client.value.state.tokens[0].position, destination);
    assert.deepEqual(client.value.tokenWalkEvents, [walk]);
    if (first === 'HTTP') { client.event(walk); client.snapshot(accepted); }
    assert.deepEqual(client.value.tokenWalkEvents, [walk], 'second delivery must not restart animation');
  });
}

test('rejection leaves the token at origin with a reason and no walking delivery', async (t) => {
  const client = await mount(t);
  const pending = client.value.moveOwnedToken('hero', 4, 1, walk.waypoints);
  await client.settle();
  client.requests[0].respond({ ...snapshot(), message: 'Ostacolo blocca il movimento.' }, false);
  await pending; await client.settle();
  assert.deepEqual(client.value.state.tokens[0].position, origin);
  assert.equal(client.value.tokenWalkEvents.length, 0);
  assert.match(client.value.movementNotice.message, /Ostacolo/);
});

test('queued keyboard steps use the preceding confirmed position', async (t) => {
  const client = await mount(t);
  const first = client.value.moveOwnedTokenBy('hero', 1, 0);
  const second = client.value.moveOwnedTokenBy('hero', 1, 0);
  await client.settle();
  assert.equal(client.requests.length, 1);
  assert.equal(client.requests[0].body.x, 2);
  client.requests[0].respond(snapshot({ x: 2, y: 1 }, 2));
  await first; await client.settle();
  assert.equal(client.requests[1].body.x, 3);
  client.requests[1].respond(snapshot({ x: 3, y: 1 }, 3));
  await second; await client.settle();
  assert.equal(client.value.state.tokens[0].position.x, 3);
});

test('a lost HTTP reply preserves a movement already accepted over SSE', async (t) => {
  const client = await mount(t);
  const pending = client.value.moveOwnedToken('hero', 4, 1, walk.waypoints);
  await client.settle();
  client.event(walk); client.snapshot(snapshot(destination, 2));
  client.requests[0].reject(new Error('Connessione interrotta'));
  await pending; await client.settle();
  assert.deepEqual(client.value.state.tokens[0].position, destination);
  assert.deepEqual(client.value.tokenWalkEvents, [walk]);
});
