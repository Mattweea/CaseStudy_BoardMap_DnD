import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once, EventEmitter } from 'node:events';
import { cpSync, lstatSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { openDatabase } from '../database/connection.mjs';
import { migrate } from '../database/migrator.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aDxQAAAAASUVORK5CYII=', 'base64');

// Copy only source modules: production storage paths are relative to server/index.mjs.
// Starting the copy isolates snapshots, portraits and backgrounds as well as SQLite.
async function isolatedServer(t) {
  const directory = mkdtempSync(join(tmpdir(), 'vtt-multi-scene-session-'));
  const databasePath = join(directory, 'game.sqlite');
  let child = null, output = '';
  const streams = new Set();
  const stop = async () => {
    await Promise.all([...streams].map((stream) => stream.close()));
    streams.clear();
    if (child && child.exitCode === null && child.signalCode === null) {
      const stopped = once(child, 'exit', { signal: AbortSignal.timeout(5000) });
      child.kill('SIGTERM');
      try { await stopped; } catch (error) { child.kill('SIGKILL'); throw error; }
    }
  };
  t.after(async () => { try { await stop(); } finally { rmSync(directory, { recursive: true, force: true }); } });
  for (const name of ['server', 'shared', 'database']) {
    cpSync(join(root, name), join(directory, name), { recursive: true,
      filter: (source) => lstatSync(source).isDirectory()
        ? !['data', 'node_modules'].includes(source.split('/').at(-1)) : source.endsWith('.mjs') });
  }
  symlinkSync(join(root, 'node_modules'), join(directory, 'node_modules'), 'dir');
  const db = openDatabase({ path: databasePath });
  try { await migrate(db); } finally { db.close(); }
  mkdirSync(join(directory, 'server/data'), { recursive: true });
  const snapshot = join(directory, 'server/data/last-session.json');
  writeFileSync(snapshot, JSON.stringify({ version: 7, savedAt: '2026-09-01T00:00:00Z', state: {
    diagonalRule: 'alternating', measurementUnit: { label: 'ft', cellsValue: 5 }, isBoardFullyLit: true,
    lightSources: [{ id: 'legacy-torch', position: { x: 4, y: 7 }, radiusCells: 6 }],
    tokens: [{ id: 'legacy-runtime-only', name: 'Legacy', type: 'enemy', position: { x: 20, y: 20 } }],
  } }));
  const fixture = { directory, databasePath, snapshot, stop, base: '', streams,
    start: async () => {
      const env = { ...process.env, VTT_DB_PATH: databasePath, HOST: '127.0.0.1', PORT: '0' };
      delete env.BATTLE_MAP_TEST_MODE; delete env.NODE_TEST_CONTEXT;
      child = spawn(process.execPath, [join(directory, 'server/index.mjs')], { cwd: directory, env, stdio: ['ignore', 'pipe', 'pipe'] });
      output = '';
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`Server startup timed out: ${output.slice(-2000)}`)), 10000);
        const failed = (error) => { clearTimeout(timer); reject(error); };
        child.once('error', failed);
        child.once('exit', (code) => failed(new Error(`Server exited (${code}): ${output.slice(-2000)}`)));
        const receive = (chunk) => {
          output += chunk;
          const address = output.match(/Server listening at (http:\/\/127\.0\.0\.1:\d+)/);
          if (address) { clearTimeout(timer); fixture.base = address[1]; resolve(); }
        };
        child.stdout.on('data', receive); child.stderr.on('data', receive);
      });
    },
  };
  return fixture;
}

async function request(f, cookie, method, path, payload, status = 200, headers = {}) {
  const response = await fetch(f.base + path, { method, signal: AbortSignal.timeout(5000),
    headers: { connection: 'close', ...(cookie ? { cookie } : {}), ...(payload === undefined ? {} : { 'content-type': 'application/json' }), ...headers },
    body: payload === undefined ? undefined : Buffer.isBuffer(payload) ? payload : JSON.stringify(payload) });
  assert.equal(response.status, status, `${method} ${path}: ${await response.clone().text()}`);
  return response;
}
const json = async (...args) => (await request(...args)).json();
const state = (f, cookie) => json(f, cookie, 'GET', '/api/battle-map/state');
async function login(f, username) {
  const response = await request(f, null, 'POST', '/api/auth/login', { username, password: 'password' });
  return response.headers.get('set-cookie').split(';')[0];
}

async function connect(f, cookie) {
  const controller = new AbortController();
  const response = await fetch(f.base + '/api/battle-map/stream', { headers: { cookie }, signal: controller.signal });
  assert.equal(response.status, 200);
  const events = new EventEmitter(), frames = [];
  let failure = null;
  const pump = (async () => {
    const decoder = new TextDecoder(); let buffer = '';
    try {
      for await (const chunk of response.body) {
        buffer += decoder.decode(chunk, { stream: true });
        let end;
        while ((end = buffer.indexOf('\n\n')) !== -1) {
          const frame = buffer.slice(0, end); buffer = buffer.slice(end + 2);
          const data = frame.split('\n').find((line) => line.startsWith('data: '));
          if (!data) continue;
          frames.push({ event: frame.match(/^event: (.+)$/m)?.[1] ?? 'snapshot', data: JSON.parse(data.slice(6)) });
          events.emit('frame');
        }
      }
    } catch (error) { if (!controller.signal.aborted) { failure = error; events.emit('frame'); } }
  })();
  const stream = { frames,
    wait: async (predicate) => {
      const signal = AbortSignal.timeout(5000);
      while (!frames.some(predicate)) { if (failure) throw failure; await once(events, 'frame', { signal }); }
      return frames.find(predicate).data;
    },
    close: async () => { controller.abort(); await pump; f.streams.delete(stream); },
  };
  f.streams.add(stream);
  await stream.wait((frame) => frame.event === 'snapshot');
  return stream;
}

test('one server serves the frontend build while preserving API authorization and file boundaries', async (t) => {
  const f = await isolatedServer(t);
  mkdirSync(join(f.directory, 'dist/assets'), { recursive: true });
  writeFileSync(join(f.directory, 'dist/index.html'), '<!doctype html><div id="root">Frontend</div>');
  writeFileSync(join(f.directory, 'dist/assets/app.js'), 'console.log("frontend");');
  writeFileSync(join(f.directory, 'dist/.env'), 'PRIVATE=value');
  await f.start();

  const page = await request(f, null, 'GET', '/');
  assert.match(page.headers.get('content-type'), /text\/html/);
  assert.match(await page.text(), /Frontend/);
  assert.equal(await (await request(f, null, 'GET', '/assets/app.js')).text(), 'console.log("frontend");');
  assert.equal((await json(f, null, 'GET', '/api/health')).ok, true);
  await request(f, null, 'GET', '/api/battle-map/state', undefined, 401);
  for (const path of ['/api/missing', '/assets/missing.js', '/server/data/last-session.json', '/database/connection.mjs', '/.env']) {
    const response = await request(f, null, 'GET', path, undefined, 404);
    assert.match(response.headers.get('content-type'), /application\/json/);
  }
  const master = await login(f, 'master'), player = await login(f, 'vesuth');
  assert.ok((await state(f, master)).state.sceneCatalog);
  assert.ok(!('sceneCatalog' in (await state(f, player)).state));
});

test('production session crosses two scenes with three HTTP/SSE users, then recovers preparation after a real restart', { timeout: 30000 }, async (t) => {
  const f = await isolatedServer(t); await f.start();
  const cookies = await Promise.all(['master', 'vesuth', 'ilthar'].map((name) => login(f, name)));
  const [master, vesuth, ilthar] = cookies;
  let streams = await Promise.all(cookies.map((cookie) => connect(f, cookie)));
  const initial = await state(f, master), a = initial.state.activeSceneId;
  assert.equal(a, 'initial-scene'); assert.equal(initial.state.sceneCatalog.length, 1);
  assert.equal(initial.state.diagonalRule, 'alternating');
  assert.deepEqual(initial.state.measurementUnit, { label: 'ft', cellsValue: 5 });
  assert.equal(initial.state.lightSources[0].id, 'legacy-torch');
  assert.ok(!initial.state.tokens.some((token) => token.id === 'legacy-runtime-only'));
  const party = initial.state.tokens.filter((token) => token.type === 'player');
  assert.equal(party.length, 2);
  const hero = party.find((token) => token.ownerUserId === 'player-vesuth');
  const detail = (id) => json(f, master, 'GET', `/api/scenes/${id}`);
  const edit = async (id, suffix, payload, method = 'POST', status = 200) => {
    const scene = await detail(id);
    return json(f, master, method, `/api/scenes/${id}${suffix}`, { baseVersion: scene.version, ...payload }, status);
  };
  const activate = async (id) => edit(id, '/activate', {});
  const converged = async (id) => {
    const views = await Promise.all(cookies.map((cookie) => state(f, cookie)));
    for (const [index, view] of views.entries()) {
      assert.equal(view.state.activeSceneId, id);
      assert.equal(view.version, views[0].version);
      const received = await streams[index].wait((frame) => frame.event === 'snapshot' && frame.data.version === view.version);
      assert.deepEqual(received, view);
      if (index) assert.ok(!('sceneCatalog' in view.state));
    }
    return views[0];
  };
  const b = (await json(f, master, 'POST', '/api/scenes', { name: 'Fortezza segreta' }, 201)).id;
  const counts = streams.map((stream) => stream.frames.length);
  await edit(b, '', { name: 'Fortezza', boardDimensions: { columns: 26, rows: 24 }, isFullyLit: false }, 'PATCH');
  await request(f, master, 'PUT', `/api/scenes/${b}/background`, png, 200,
    { 'content-type': 'image/png', 'x-scene-base-version': String((await detail(b)).version) });
  await edit(b, '', { backgroundCalibration: { scale: 1.75, offsetX: -30, offsetY: 45 } }, 'PATCH');
  const drawing = { id: 'secret-stroke', color: '#ff9900', widthCells: .2, points: [{ x: 1.5, y: 2 }, { x: 3, y: 4 }] };
  await edit(b, '/drawings', { drawing });
  await edit(b, '/drawings/undo', {}); await edit(b, '/drawings/redo', {});
  await edit(b, '/elements', { element: { id: 'wall', kind: 'rock', position: { x: 10, y: 8 },
    widthCells: 1, heightCells: 1, rotation: 0, blocksMovement: true, blocksVision: false } });
  await edit(b, '/elements', { element: { id: 'screen', kind: 'rock', position: { x: 14, y: 8 },
    widthCells: 2, heightCells: 1, rotation: 90, blocksMovement: false, blocksVision: true } });
  const encounter = (await edit(b, '/encounters', { encounter: { name: 'PRIVATE-ENCOUNTER', kind: 'combat' } }, 'POST', 201)).document.encounters[0];
  const path = `/encounters/${encounter.id}`;
  let prepared = await edit(b, path + '/entities', { entity: { kind: 'monster', name: 'Guardia ogre',
    tokenProperties: { hitPoints: 29, maxHitPoints: 29, widthCells: 2, heightCells: 2 } } }, 'POST', 201);
  const monster = prepared.document.entityReferences[0];
  prepared = await edit(b, path + '/entities', { entity: { kind: 'npc', name: 'PRIVATE-NPC' } }, 'POST', 201);
  const npc = prepared.document.entityReferences[1];
  prepared = await edit(b, path + '/placements', { placement: { entityReferenceId: monster.id, position: { x: 18, y: 18 } } }, 'POST', 201);
  const monsterId = prepared.document.preparedPlacements[0].id;
  prepared = await edit(b, path + '/placements', { placement: { entityReferenceId: npc.id, position: { x: 22, y: 20 }, isHidden: true } }, 'POST', 201);
  assert.equal((await state(f, master)).version, initial.version);
  assert.deepEqual(streams.map((stream) => stream.frames.length), counts);
  for (const cookie of [vesuth, ilthar]) {
    const view = await state(f, cookie);
    assert.ok(!JSON.stringify(view).includes(b));
    await request(f, cookie, 'GET', `/api/scenes/${b}/background`, undefined, 403);
    await request(f, cookie, 'GET', '/api/scenes', undefined, 403);
    await request(f, cookie, 'POST', `/api/scenes/${b}/activate`, { baseVersion: prepared.version }, 403);
    await request(f, cookie, 'POST', `/api/scenes/${b}${path}/placements`, { baseVersion: prepared.version, placement: {} }, 403);
  }
  await activate(b);
  let current = await converged(b);
  assert.deepEqual(current.state.activeSceneDrawings, [drawing]);
  assert.deepEqual(current.state.boardDimensions, { columns: 26, rows: 24 });
  assert.equal(current.state.activeSceneBackground.scale, 1.75); assert.equal(current.state.activeSceneBackground.offsetX, -30);
  assert.equal(current.state.isBoardFullyLit, false); assert.equal(current.state.tokens.length, 2);
  for (const cookie of [vesuth, ilthar]) {
    const view = await state(f, cookie);
    assert.deepEqual(view.state.tokens.map((token) => token.id), [monsterId]);
    assert.ok(!JSON.stringify(view).includes('PRIVATE-'));
    assert.deepEqual((await request(f, cookie, 'GET', `/api/scenes/${b}/background`)).headers.get('content-type'), 'image/png');
  }
  await login(f, 'vesuth'); // a character left in A must not spawn a duplicate in B
  assert.equal((await state(f, master)).state.tokens.length, 2);
  await request(f, vesuth, 'POST', '/api/battle-map/move', { tokenId: hero.id, x: 9, y: 8,
    sceneId: a, sceneVersion: initial.state.activeSceneVersion }, 409);
  await activate(a); await converged(a);
  const transition = { targetSceneId: b, sourceVersion: (await detail(a)).version,
    targetVersion: prepared.version, anchor: { x: 8, y: 8 } };
  const preview = await json(f, master, 'POST', '/api/scenes/party-transition/preview', transition);
  assert.deepEqual(new Set(preview.placements.map((item) => item.tokenId)), new Set(party.map((token) => token.id)));
  await request(f, master, 'POST', '/api/scenes/party-transition/commit', { ...transition, stateVersion: preview.stateVersion + 1 }, 409);
  current = await json(f, master, 'POST', '/api/scenes/party-transition/commit', { ...transition, stateVersion: preview.stateVersion });
  await converged(b);
  for (const stream of streams) assert.equal(stream.frames.filter((frame) => frame.event === 'snapshot' && frame.data.version === current.version).length, 1);
  assert.equal(current.state.tokens.length, 4);
  assert.equal(current.state.tokens.find((token) => token.id === hero.id).ownerUserId, hero.ownerUserId);
  await json(f, master, 'POST', '/api/battle-map/settings', { diagonalRule: 'alternating', measurementUnit: { label: 'ft', cellsValue: 5 } });
  await json(f, master, 'POST', '/api/battle-map/move', { tokenId: hero.id, x: 9, y: 8 });
  const identity = { sceneId: b, sceneVersion: (await detail(b)).version };
  const blocked = await json(f, vesuth, 'POST', '/api/battle-map/move', { ...identity, tokenId: hero.id, x: 10, y: 8 }, 400);
  assert.match(blocked.message, /ostacol|blocca/i);
  await json(f, vesuth, 'POST', '/api/battle-map/move', { ...identity, tokenId: hero.id, x: 9, y: 9 });
  await converged(b);
  await json(f, vesuth, 'POST', '/api/battle-map/ping', { ...identity, position: { x: 4, y: 4 } });
  await streams[2].wait((frame) => frame.event === 'ephemeral-ping');
  await streams[2].close(); streams[2] = await connect(f, ilthar);
  assert.equal(streams[2].frames[0].data.state.activeSceneId, b);
  assert.ok(streams[2].frames.every((frame) => frame.event === 'snapshot'));
  await json(f, master, 'POST', '/api/battle-map/combat/start', {});
  await json(f, vesuth, 'POST', '/api/battle-map/initiative/roll', { ...identity, tokenId: hero.id });
  await json(f, master, 'POST', '/api/battle-map/combat/round/start', {});
  const beforeReject = await converged(b);
  await request(f, master, 'POST', `/api/scenes/${a}/activate`, { baseVersion: (await detail(a)).version }, 409);
  assert.deepEqual(await state(f, master), beforeReject);
  await json(f, master, 'POST', '/api/battle-map/combat/end', {});
  current = await state(f, master);
  const live = structuredClone(current.state), instance = live.tokens.find((token) => token.id === monsterId);
  instance.hitPoints = 1; instance.conditions = ['prone']; instance.position = { x: 16, y: 16 };
  await json(f, master, 'PUT', '/api/battle-map/state', { baseVersion: current.version, state: live });
  await activate(a); assert.equal((await converged(a)).state.tokens.length, 0);
  await activate(b); current = await converged(b);
  assert.equal(current.state.tokens.find((token) => token.id === monsterId).hitPoints, 1);
  await edit(b, path + `/entities/${monster.id}`, { entity: { kind: 'monster', name: 'Ogre veterano',
    tokenProperties: monster.tokenProperties } }, 'PATCH');
  const reconciled = (await converged(b)).state.tokens.find((token) => token.id === monsterId);
  assert.equal(reconciled.name, 'Ogre veterano'); assert.equal(reconciled.hitPoints, 1);
  assert.deepEqual(reconciled.position, { x: 16, y: 16 }); assert.deepEqual(reconciled.conditions, ['prone']);
  const savedA = await detail(a), savedB = await detail(b);
  assert.equal(savedB.document.entityReferences[0].tokenProperties.hitPoints, 29);
  assert.deepEqual(savedB.document.preparedPlacements[0].position, { x: 18, y: 18 });
  await f.stop();
  // A conflicting legacy snapshot must never reimport or replace an existing catalog.
  writeFileSync(f.snapshot, JSON.stringify({ state: { diagonalRule: 'standard', measurementUnit: { label: 'changed', cellsValue: 99 } } }));
  await f.start();
  await request(f, master, 'GET', '/api/battle-map/state', undefined, 401);
  const newMaster = await login(f, 'master'), recovered = await state(f, newMaster);
  assert.equal(recovered.state.activeSceneId, b); assert.equal(recovered.state.sceneCatalog.length, 2);
  for (const saved of [savedA, savedB]) {
    const scene = await json(f, newMaster, 'GET', `/api/scenes/${saved.id}`);
    assert.deepEqual(scene.document, saved.document); assert.equal(scene.version, saved.version);
    assert.deepEqual(scene.drawingHistory, { canUndo: false, canRedo: false });
  }
  assert.equal(recovered.state.tokens.length, 2);
  const restored = recovered.state.tokens.find((token) => token.id === monsterId);
  assert.equal(restored.name, 'Ogre veterano'); assert.equal(restored.hitPoints, 29);
  assert.deepEqual(restored.position, { x: 18, y: 18 });
  assert.deepEqual(restored.conditions, []); assert.equal(recovered.state.sessionMode, 'exploration');
  assert.deepEqual(recovered.state.initiatives, []); assert.equal(recovered.state.activeTurnTokenId, null);
  assert.equal(recovered.state.activeSceneBackground.assetId, savedB.document.background.assetId);
  const asset = await request(f, newMaster, 'GET', `/api/scenes/${b}/background`);
  assert.deepEqual(Buffer.from(await asset.arrayBuffer()), png);
  for (const name of ['vesuth', 'ilthar']) {
    const cookie = await login(f, name), stream = await connect(f, cookie);
    const view = await state(f, cookie);
    const delivered = await stream.wait((frame) => frame.event === 'snapshot' && frame.data.version === view.version);
    assert.equal(delivered.state.activeSceneId, b); assert.ok(!('sceneCatalog' in delivered.state));
    assert.ok(!JSON.stringify(delivered).includes('PRIVATE-'));
  }
});
