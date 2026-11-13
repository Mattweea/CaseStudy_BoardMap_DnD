import assert from 'node:assert/strict';
import { cpSync, lstatSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Optional browser verification: run after npm run build; all server storage is isolated.
const root = fileURLToPath(new URL('../', import.meta.url));
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const { openDatabase } = await import(pathToFileURL(join(root, 'database/connection.mjs')));
const { migrate } = await import(pathToFileURL(join(root, 'database/migrator.mjs')));
const directory = mkdtempSync(join(tmpdir(), 'dnd-wall-ui-'));
let child, browser;
try {
  for (const name of ['server', 'shared', 'database']) cpSync(join(root, name), join(directory, name), {
    recursive: true, filter: (path) => lstatSync(path).isDirectory()
      ? !['data', 'node_modules'].includes(path.split('/').at(-1)) : path.endsWith('.mjs'),
  });
  symlinkSync(join(root, 'node_modules'), join(directory, 'node_modules'), 'dir');
  symlinkSync(join(root, 'dist'), join(directory, 'dist'), 'dir');
  const dbPath = join(directory, 'test.sqlite');
  const db = openDatabase({ path: dbPath });
  try { await migrate(db); } finally { db.close(); }
  const env = { ...process.env, PORT: '0', HOST: '127.0.0.1', VTT_DB_PATH: dbPath };
  delete env.BATTLE_MAP_TEST_MODE;
  child = spawn(process.execPath, [join(directory, 'server/index.mjs')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  const base = await new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(Error(output)), 15000);
    const receive = (chunk) => {
      output += chunk;
      const match = output.match(/Server listening at (http:\/\/127\.0\.0\.1:\d+)/);
      if (match) { clearTimeout(timer); resolve(match[1]); }
    };
    child.stdout.on('data', receive); child.stderr.on('data', receive);
    child.once('exit', (code) => { clearTimeout(timer); reject(Error(`Backend ${code}: ${output}`)); });
  });
  browser = await chromium.launch({ headless: true });
  const master = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const player = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  for (const [context, username] of [[master, 'master'], [player, 'thalendir']]) {
    const response = await context.request.post(base + '/api/auth/login', { data: { username, password: 'password' } });
    assert.equal(response.status(), 200);
    const { user } = await response.json();
    await context.addInitScript((id) => localStorage.setItem(`dnd-battle-map:intro-seen:${id}`, 'true'), user.id);
  }
  const m = await master.newPage(), p = await player.newPage();
  m.setDefaultTimeout(7000); p.setDefaultTimeout(7000);
  const errors = [];
  for (const page of [m, p]) page.on('pageerror', (e) => errors.push(e.message));
  await Promise.all([m.goto(base), p.goto(base)]);
  const state = (await (await master.request.get(base + '/api/battle-map/state')).json()).state;
  const sceneId = state.activeSceneId;
  const readScene = async () => (await master.request.get(`${base}/api/scenes/${sceneId}`)).json();
  const scene = await readScene();
  const cells = Array.from({length:5},(_,y)=>({x:3,y}));
  const saved = await master.request.post(`${base}/api/scenes/${sceneId}/wall-cells`, {data:{baseVersion:scene.version,operation:'add',cells}});
  assert.equal(saved.status(),200);
  await m.locator('.wall-cells-layer path').first().waitFor();
  await p.waitForFunction(()=>document.querySelector('.wall-cells-layer path')?.getAttribute('d').includes('M3,4'));
  assert.equal(await m.locator('.wall-cells-layer').first().evaluate(e=>getComputedStyle(e).pointerEvents),'none');
  const outline = await m.locator('.wall-cells-layer path').nth(1).getAttribute('d');
  assert.equal((outline.match(/M/g)||[]).length,12);
  await m.locator('.board-actions button').first().evaluate(b=>b.click());
  await m.locator('.board-fullscreen-overlay .wall-cells-layer').waitFor();
  await m.locator('.board-fullscreen-overlay .board-actions button').first().evaluate(b=>b.click());
  await m.locator('.board-fullscreen-overlay').waitFor({state:'detached'});
  await m.getByRole('button',{name:'Apri preparazione scene'}).click();
  await m.locator('.scene-catalog__list button').first().click();
  await m.locator('.scene-catalog .wall-cells-layer').waitFor();
  await m.screenshot({path:'/tmp/dnd-scene-wizard.png'});
  assert.deepEqual(errors,[]);
  console.log('PASS: celle strutturali unite, SSE Master/Player, fullscreen e preview condivisa.');
} finally {
  await browser?.close();
  if (child && child.exitCode === null) {
    const stopped = once(child, 'exit');
    const timer = setTimeout(() => child.kill('SIGKILL'), 3000);
    child.kill('SIGTERM');
    try { await stopped; } finally { clearTimeout(timer); }
  }
  rmSync(directory,{recursive:true,force:true});
}
