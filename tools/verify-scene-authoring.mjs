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
  const cover = '.board-darkness-layer > rect[mask]';
  await m.locator(cover).waitFor(); await p.locator(cover).waitFor();
  assert.equal(await m.locator(cover).getAttribute('fill-opacity'), '0.45');
  assert.equal(await p.locator(cover).getAttribute('fill-opacity'), '1');
  assert.equal(await p.getByRole('button', { name: 'Apri preparazione scene' }).count(), 0);
  assert.equal(await m.locator('.board-darkness-layer').evaluate((e) => getComputedStyle(e).pointerEvents), 'none');
  // The repository CSS hides the legacy fullscreen header control; exercise its existing handler.
  await m.locator('.board-actions button').first().evaluate((button) => button.click());
  await m.locator('.board-fullscreen-overlay').waitFor();
  assert.equal(await m.locator('.board-fullscreen-overlay ' + cover).getAttribute('fill-opacity'), '0.45');
  await m.locator('.board-fullscreen-overlay .board-actions button').first().evaluate((button) => button.click());
  await m.locator('.board-fullscreen-overlay').waitFor({ state: 'detached' });
  await m.getByRole('button', { name: 'Mostra luce nella scena attiva', exact: true }).click();
  await m.locator(cover).waitFor({ state: 'detached' });
  await p.locator(cover).waitFor({ state: 'detached' });
  await m.getByRole('button', { name: 'Mostra buio nella scena attiva', exact: true }).click();
  await m.locator(cover).waitFor(); await p.locator(cover).waitFor();
  await m.screenshot({ path: '/tmp/dnd-master-darkness.png' });
  await p.screenshot({ path: '/tmp/dnd-player-darkness.png' });
  console.log('PASS: Master 45%, Player opaque, fullscreen, light toggle and pointer transparency.');

  const sceneId = (await (await master.request.get(base + '/api/battle-map/state')).json()).state.activeSceneId;
  const readScene = async () => (await master.request.get(`${base}/api/scenes/${sceneId}`)).json();
  const mutations = [];
  m.on('request', (request) => {
    if (request.method() === 'POST' && request.url().endsWith('/walls')) mutations.push(request.postDataJSON());
  });
  await m.getByRole('button', { name: 'Apri preparazione scene' }).click();
  await m.getByRole('dialog', { name: 'Preparazione scene' }).waitFor();
  await m.locator('.scene-catalog__list button').first().click();
  await m.getByRole('button', { name: 'Disegna muri', exact: true }).waitFor();
  assert.equal(await m.getByText('Segmento da tastiera', { exact: true }).count(), 0);
  assert.equal(await m.getByRole('button', { name: 'Segmenti', exact: true }).getAttribute('aria-pressed'), 'true');
  await m.getByRole('button', { name: 'Disegna muri', exact: true }).click();
  const overlay = m.getByLabel('Tracciamento muri', { exact: true });
  await overlay.scrollIntoViewIfNeeded();
  const box = await overlay.boundingBox();
  const xy = (x, y) => ({ x: box.x + box.width * x, y: box.y + box.height * y });
  const click = async (x, y) => { const point = xy(x, y); await m.mouse.click(point.x, point.y); };
  await click(0.173, 0.213);
  await m.mouse.move(xy(.45, .22).x, xy(.45, .22).y, { steps: 60 });
  await click(.45, .22);
  await m.mouse.move(xy(.55, .42).x, xy(.55, .42).y, { steps: 60 });
  await click(.55, .42);
  assert.equal(mutations.length, 0);
  const saved = m.waitForResponse((r) => r.request().method() === 'POST' && r.url().endsWith('/walls'));
  await m.keyboard.press('Space'); assert.equal((await saved).status(), 200);
  await m.getByRole('button', { name: 'Conferma muro', exact: true }).waitFor();
  assert.equal(mutations.length, 1);
  assert.equal(mutations[0].wall.points.length, 3);
  assert.ok(mutations[0].wall.points.some((v) => !Number.isInteger(v.x) || !Number.isInteger(v.y)));
  const view = await overlay.evaluate((svg) => ({x:svg.viewBox.baseVal.x,y:svg.viewBox.baseVal.y,width:svg.viewBox.baseVal.width,height:svg.viewBox.baseVal.height}));
  assert.ok(Math.abs(mutations[0].wall.points[0].x - (view.x + view.width * .173)) < 1e-6);
  assert.ok(Math.abs(mutations[0].wall.points[0].y - (view.y + view.height * .213)) < 1e-6);
  assert.equal((await readScene()).document.walls.length, 1);
  console.log('PASS: 120 pointer moves produce exactly three fractional vertices and one versioned write.');

  await click(.2, .2); await click(.3, .3);
  await m.keyboard.press('Backspace');
  assert.equal(await m.getByRole('button', { name: 'Conferma muro', exact: true }).isDisabled(), true);
  await m.keyboard.press('Escape');
  assert.equal(mutations.length, 1);
  await click(.2, .2); await click(.3, .3);
  await m.getByRole('button', { name: 'Libero', exact: true }).click();
  const a=xy(.15,.48),b=xy(.4,.55);
  await m.mouse.move(a.x,a.y); await m.mouse.down(); await m.mouse.move(b.x,b.y,{steps:12});
  const drawn=m.waitForResponse(r=>r.request().method()==='POST'&&r.url().endsWith('/walls'));
  await m.mouse.up();assert.equal((await drawn).status(),200);
  assert.equal(mutations.length,2);assert.ok(mutations[1].wall.points.length>3);
  await m.getByRole('button', { name: 'Segmenti', exact: true }).click();
  await overlay.focus();await m.keyboard.press('v');await m.keyboard.press('Shift+ArrowRight');await m.keyboard.press('v');
  const typed=m.waitForResponse(r=>r.request().method()==='POST'&&r.url().endsWith('/walls'));
  await m.keyboard.press('Enter');assert.equal((await typed).status(),200);
  assert.equal(mutations.length,3);assert.equal(mutations[2].wall.points.length,2);
  assert.equal(mutations[2].wall.points[1].x-mutations[2].wall.points[0].x,.25);
  assert.equal((await readScene()).document.walls.length,3);
  await m.getByRole('button',{name:'Aumenta zoom anteprima',exact:true}).click();
  await overlay.scrollIntoViewIfNeeded();
  const zoomBox=await overlay.boundingBox();
  await m.mouse.click(zoomBox.x+zoomBox.width*.2,zoomBox.y+zoomBox.height*.2);
  await m.mouse.click(zoomBox.x+zoomBox.width*.3,zoomBox.y+zoomBox.height*.2);
  const zoomed=m.waitForResponse(r=>r.request().method()==='POST'&&r.url().endsWith('/walls'));
  await m.keyboard.press('Space');assert.equal((await zoomed).status(),200);
  assert.ok(Math.abs(mutations[3].wall.points[0].x-(view.x+view.width*.2))<1e-6);
  assert.ok(Math.abs(mutations[3].wall.points[1].x-(view.x+view.width*.3))<1e-6);
  const current=await readScene();
  await overlay.focus();await m.keyboard.press('v');await m.keyboard.press('ArrowRight');await m.keyboard.press('v');
  const update=await master.request.patch(`${base}/api/scenes/${sceneId}`,{data:{baseVersion:current.version,name:'Conflitto simulato'}});
  assert.equal(update.status(),200);
  const rejected=m.waitForResponse(r=>r.request().method()==='POST'&&r.url().endsWith('/walls'));
  await m.getByRole('button',{name:'Conferma muro',exact:true}).click();assert.equal((await rejected).status(),409);
  assert.equal((await readScene()).document.walls.length,4);
  console.log('PASS: transformed world coordinates and stale-version rejection without a partial wall.');
  assert.deepEqual(errors,[]);
  await m.screenshot({path:'/tmp/dnd-wall-editor.png'});
  console.log('PASS: Backspace, Escape, mode reset, freehand release and keyboard-only drawing.');
  const touch=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const touchLogin=await touch.request.post(base+'/api/auth/login',{data:{username:'master',password:'password'}});
  assert.equal(touchLogin.status(),200);
  const touchUser=(await touchLogin.json()).user;
  await touch.addInitScript((id)=>localStorage.setItem(`dnd-battle-map:intro-seen:${id}`,'true'),touchUser.id);
  const mobile=await touch.newPage();mobile.setDefaultTimeout(10000);await mobile.goto(base);
  await mobile.getByRole('button',{name:'Apri preparazione scene'}).click();
  await mobile.locator('.scene-catalog__list button').first().click();
  await mobile.getByRole('button',{name:'Disegna muri',exact:true}).click();
  const mobileOverlay=mobile.getByLabel('Tracciamento muri',{exact:true});await mobileOverlay.scrollIntoViewIfNeeded();
  const mobileBox=await mobileOverlay.boundingBox();
  await mobile.touchscreen.tap(mobileBox.x+mobileBox.width*.25,mobileBox.y+mobileBox.height*.25);
  await mobile.touchscreen.tap(mobileBox.x+mobileBox.width*.5,mobileBox.y+mobileBox.height*.4);
  const tapped=mobile.waitForResponse(r=>r.request().method()==='POST'&&r.url().endsWith('/walls'));
  await mobile.getByRole('button',{name:'Conferma muro',exact:true}).click();assert.equal((await tapped).status(),200);
  assert.equal((await readScene()).document.walls.length,5);await touch.close();
  console.log('PASS: touch vertices and explicit confirmation at 390px.');
  await master.close();await player.close();
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
