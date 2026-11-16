import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

// Real component and stylesheet, isolated from the live server, storage and database.
const root = fileURLToPath(new URL('../', import.meta.url));
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const css = await readFile(new URL('../src/styles/index.css', import.meta.url), 'utf8');
const bundled = await build({ bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  resolveExtensions: ['.tsx', '.ts', '.mjs', '.js', '.json'],
  stdin: { resolveDir: root, sourcefile: 'aura-browser-fixture.tsx', loader: 'tsx', contents: `
    import { useEffect, useState } from 'react';
    import { createRoot } from 'react-dom/client';
    import { AuraPresenceBanner } from './src/components/AuraPresenceBanner';
    function Fixture() {
      const [config, setConfig] = useState({ count: 3, inside: true, fullscreen: false, scene: 'scene-a', user: 'player', long: false });
      useEffect(() => {
        window.updateAuraFixture = patch => setConfig(current => ({ ...current, ...patch }));
        document.getElementById('normal').hidden = config.fullscreen;
        document.getElementById('fullscreen').hidden = !config.fullscreen;
      }, [config]);
      const owner = { id: 'hunter', name: 'Hunter', ownerUserId: 'hunter-user', position: { x: 5, y: 5 },
        auras: Array.from({ length: config.count }, (_, i) => ({ id: 'aura-' + i, name: 'Aura ' + (i + 1),
          effect: config.long ? ('Effetto lungo con tutti i dettagli. '.repeat(20)).slice(0, 500) : 'Effetto ' + (i + 1),
          radiusCells: 3, active: true })) };
      const hero = { id: 'hero', name: 'Sylas', ownerUserId: 'player', position: { x: config.inside ? 5 : 25, y: 5 } };
      return <AuraPresenceBanner host={document.getElementById(config.fullscreen ? 'fullscreen' : 'normal')}
        state={{ activeSceneId: config.scene, tokens: [owner, hero] }} userId={config.user} />;
    }
    window.boardKeys = 0;
    window.addEventListener('keydown', () => window.boardKeys++);
    createRoot(document.getElementById('app')).render(<Fixture />);
  ` } });
const controls = '<div class="axis">Coordinate della mappa</div><div class="board-zoom-controls"><button class="board-zoom-button" aria-label="Zoom in">+</button><button class="board-zoom-button" aria-label="Zoom out">−</button></div><button class="map-action" aria-label="Comando mappa">Mappa</button>';
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/style.css"><style>
  body { margin: 0; overflow: auto; } #app { height: 0; }
  .fixture-map { position: relative; width: min(920px, calc(100% - 32px)); height: calc(100dvh - 32px); margin: 16px; overflow: hidden;
    background-color: #eee9e0; background-image: linear-gradient(#d8d0c955 1px, transparent 1px), linear-gradient(90deg, #d8d0c955 1px, transparent 1px); background-size: 48px 48px; }
  .fixture-map--fullscreen { position: fixed; inset: 0; width: 100%; height: 100dvh; margin: 0; }
  .axis { position: absolute; inset: 0 0 auto; height: 30px; background: #30201e; color: #e7cbb7; font-size: 12px; }
  .map-action { position: absolute; left: 44px; bottom: 16px; }
</style></head><body><div id="app"></div><div id="normal" class="fixture-map">${controls}</div><div id="fullscreen" class="fixture-map fixture-map--fullscreen" hidden>${controls}</div><script src="/fixture.js"></script></body></html>`;
const server = createServer((request, response) => {
  if (request.url === '/style.css') { response.setHeader('Content-Type', 'text/css'); response.end(css); }
  else if (request.url === '/fixture.js') { response.setHeader('Content-Type', 'text/javascript'); response.end(bundled.outputFiles[0].text); }
  else if (request.url === '/') { response.setHeader('Content-Type', 'text/html'); response.end(html); }
  else { response.statusCode = 404; response.end(); }
});
let browser;
try {
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1100, height: 720 } });
  const errors = []; let writes = 0;
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method())) writes++; });
  await page.goto(base);
  const toggle = page.getByRole('button', { name: 'Aure applicate: 3', exact: true });
  await toggle.waitFor();
  assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(await page.getByRole('list', { name: 'Aure applicate' }).count(), 0);
  const buttonBox = await toggle.boundingBox(), mapBox = await page.locator('#normal').boundingBox();
  assert.ok(buttonBox.width < 160 && buttonBox.height <= 44);
  assert.ok(buttonBox.y >= mapBox.y + 30);
  assert.ok(Math.abs(buttonBox.x + buttonBox.width - (mapBox.x + mapBox.width - 14.4)) < 2);
  await page.screenshot({ path: '/tmp/dnd-aure-compact.png' });
  await toggle.focus(); await page.keyboard.press('Enter');
  const list = page.getByRole('list', { name: 'Aure applicate' });
  await list.waitFor(); assert.equal(await list.getByRole('listitem').count(), 3);
  const row = list.getByRole('button').first();
  await row.focus(); await page.keyboard.press('Space');
  assert.equal(await list.getByText('Effetto 1', { exact: true }).count(), 1);
  const keysBefore = await page.evaluate(() => window.boardKeys);
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => window.boardKeys), keysBefore);
  assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(await toggle.evaluate(element => element === document.activeElement), true);
  await page.evaluate(() => window.updateAuraFixture({ count: 4 }));
  const updated = page.getByRole('button', { name: 'Aure applicate: 4', exact: true });
  await updated.waitFor(); assert.equal(await updated.getAttribute('aria-expanded'), 'false');
  await page.waitForFunction(() => document.querySelector('[role="status"]')?.textContent.includes('Aura 4'));
  console.log('PASS: indicatore compatto in alto a destra, tastiera, dettagli, Escape e aggiornamenti senza riapertura o comandi di mappa.');

  await page.evaluate(() => window.updateAuraFixture({ fullscreen: true }));
  await page.locator('#fullscreen .aura-presence-banner').waitFor();
  await updated.click();
  let panelBox = await list.boundingBox();
  assert.ok(panelBox.x + panelBox.width <= 1100 && panelBox.width <= 340);
  await page.evaluate(() => window.updateAuraFixture({ inside: false }));
  await page.waitForFunction(() => !document.querySelector('.aura-presence-banner'));
  await page.evaluate(() => window.updateAuraFixture({ inside: true }));
  await updated.waitFor(); assert.equal(await updated.getAttribute('aria-expanded'), 'false');
  await updated.click();
  await page.evaluate(() => window.updateAuraFixture({ scene: 'scene-b' }));
  await page.waitForFunction(() => document.querySelector('.aura-presence-banner__toggle')?.getAttribute('aria-expanded') === 'false');
  await page.evaluate(() => window.updateAuraFixture({ user: 'master-user' }));
  await page.waitForFunction(() => !document.querySelector('.aura-presence-banner'));
  console.log('PASS: host fullscreen e reset all’uscita, al cambio scena e per il Master.');

  const mobile = await browser.newPage({ viewport: { width: 390, height: 640 }, hasTouch: true });
  mobile.on('pageerror', error => errors.push(error.message));
  await mobile.goto(base);
  await mobile.getByRole('button', { name: 'Aure applicate: 3', exact: true }).waitFor();
  await mobile.evaluate(() => window.updateAuraFixture({ count: 10, long: true }));
  const mobileToggle = mobile.getByRole('button', { name: 'Aure applicate: 10', exact: true });
  await mobileToggle.tap();
  const mobileList = mobile.getByRole('list', { name: 'Aure applicate' });
  await mobileList.getByRole('button').first().tap();
  assert.ok(await mobileList.evaluate(element => element.scrollHeight > element.clientHeight));
  panelBox = await mobileList.boundingBox();
  const mobileMap = await mobile.locator('#normal').boundingBox();
  assert.ok(panelBox.x >= mobileMap.x + 30 && panelBox.x + panelBox.width <= mobileMap.x + mobileMap.width);
  assert.ok(panelBox.y + panelBox.height <= mobileMap.y + mobileMap.height - 60);
  await mobileList.getByRole('button').last().scrollIntoViewIfNeeded();
  assert.ok(await mobileList.evaluate(element => element.scrollTop > 0));
  await mobile.screenshot({ path: '/tmp/dnd-aure-mobile.png' });
  await mobileToggle.tap();
  assert.equal(await mobileToggle.getAttribute('aria-expanded'), 'false');
  assert.deepEqual(errors, []); assert.equal(writes, 0);
  console.log('PASS: apertura e chiusura touch, effetti lunghi e scroll interno entro la mappa; nessuna mutazione di gioco.');
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
