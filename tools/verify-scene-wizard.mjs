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
  await m.getByRole('button',{name:'Costruisci pareti',exact:true}).click();
  const surface = m.getByLabel('Costruzione pareti sulla griglia',{exact:true});
  await surface.scrollIntoViewIfNeeded();
  let box=await surface.boundingBox();
  const point=(x,y)=>({x:box.x+box.width*x,y:box.y+box.height*y});
  let writes=0;
  m.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith('/wall-cells'))writes++;});
  const draw=async(x1,y1,x2,y2)=>{
    await surface.scrollIntoViewIfNeeded();box=await surface.boundingBox();
    const a=point(x1,y1),b=point(x2,y2);
    await m.mouse.move(a.x,a.y);await m.mouse.down();await m.mouse.move(b.x,b.y);
    const response=m.waitForResponse(r=>r.request().method()==='POST'&&r.url().endsWith('/wall-cells'));
    await m.mouse.up();assert.equal((await response).status(),200);
  };
  await draw(.25,.4,.6,.4);
  assert.equal(writes,1);
  assert.ok((await readScene()).document.wallCells.length>10);
  const beforeCancel=(await readScene()).document.wallCells;
  await surface.scrollIntoViewIfNeeded();box=await surface.boundingBox();
  await m.mouse.move(point(.2,.3).x,point(.2,.3).y);await m.mouse.down();
  await m.keyboard.press('Escape');await m.mouse.up();
  assert.equal(writes,1);assert.deepEqual((await readScene()).document.wallCells,beforeCancel);
  await m.getByRole('button',{name:'Rettangolo',exact:true}).click();
  await draw(.3,.5,.4,.6);assert.equal(writes,2);
  await m.getByRole('button',{name:'Gomma pareti',exact:true}).click();
  await draw(.3,.5,.4,.6);assert.equal(writes,3);
  await m.getByText('Coordinate da tastiera',{exact:true}).click();
  await m.getByLabel('Colonna parete (da 0)',{exact:true}).fill('3');
  await m.getByLabel('Riga parete (da 0)',{exact:true}).fill('0');
  const erase=m.waitForResponse(r=>r.request().method()==='POST'&&r.url().endsWith('/wall-cells'));
  await m.getByRole('button',{name:'Rimuovi celle',exact:true}).click();assert.equal((await erase).status(),200);
  assert.ok(!(await readScene()).document.wallCells.some(c=>c.x===3&&c.y===0));
  await m.getByRole('button',{name:'Pennello',exact:true}).click();
  await m.getByRole('button',{name:'Aumenta zoom anteprima',exact:true}).click();
  await draw(.2,.25,.25,.25);
  const touch=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,storageState:await master.storageState()});
  const mobile=await touch.newPage();await mobile.goto(base);
  await mobile.getByRole('button',{name:'Apri preparazione scene'}).click();
  await mobile.locator('.scene-catalog__list button').first().click();
  await mobile.getByRole('button',{name:'Costruisci pareti',exact:true}).click();
  const touchSurface=mobile.getByLabel('Costruzione pareti sulla griglia',{exact:true});
  await touchSurface.scrollIntoViewIfNeeded();const touchBox=await touchSurface.boundingBox();
  const tapped=mobile.waitForResponse(r=>r.request().method()==='POST'&&r.url().endsWith('/wall-cells'));
  await mobile.touchscreen.tap(touchBox.x+touchBox.width*.35,touchBox.y+touchBox.height*.25);
  assert.equal((await tapped).status(),200);await touch.close();
  console.log('PASS: pennello rapido, rettangolo, gomma, Escape e coordinate da tastiera.');
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
