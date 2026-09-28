import assert from 'node:assert/strict';
import test from 'node:test';
import { BOARD_CONFIG } from '../src/constants/board.ts';
import {
  applyZoomDelta,
  classifyWheelBurst,
  classifyWheelSource,
  clampZoom,
  viewportPointToWorldCell,
  wheelAction,
  zoomAtPoint,
} from '../src/utils/board.ts';

const PIXEL = 0;
const LINE = 1;
const NONE = { ctrlKey: false, altKey: false };
const CTRL = { ctrlKey: true, altKey: false };
const ALT = { ctrlKey: false, altKey: true };

test('classifyWheelSource: rotella per deltaMode a righe', () => {
  assert.equal(classifyWheelSource({ deltaMode: LINE, deltaX: 0, deltaY: 3 }), 'wheel');
});

test('classifyWheelSource: rotella per |deltaY| >= 50', () => {
  assert.equal(classifyWheelSource({ deltaMode: PIXEL, deltaX: 0, deltaY: 100 }), 'wheel');
  assert.equal(classifyWheelSource({ deltaMode: PIXEL, deltaX: 0, deltaY: -120 }), 'wheel');
});

test('classifyWheelSource: trackpad per deltaX con deltaY piccolo', () => {
  assert.equal(classifyWheelSource({ deltaMode: PIXEL, deltaX: 12, deltaY: 4 }), 'trackpad');
});

test('classifyWheelSource: trackpad per deltaY piccolo e frazionario', () => {
  assert.equal(classifyWheelSource({ deltaMode: PIXEL, deltaX: 0, deltaY: 3.33 }), 'trackpad');
});

test('classifyWheelSource: scorrimento verticale a due dita con delta interi è trackpad', () => {
  assert.equal(classifyWheelSource({ deltaMode: PIXEL, deltaX: 0, deltaY: 4 }), 'trackpad');
  assert.equal(classifyWheelSource({ deltaMode: PIXEL, deltaX: 0, deltaY: -12 }), 'trackpad');
  assert.equal(wheelAction(NONE, classifyWheelSource({ deltaMode: PIXEL, deltaX: 0, deltaY: 4 })), 'pan-xy');
});

test('classifyWheelSource: pinch con delta interi resta zoom, non pan verticale', () => {
  assert.equal(wheelAction(CTRL, classifyWheelSource({ deltaMode: PIXEL, deltaX: 0, deltaY: 3 })), 'zoom');
});

test('classifyWheelBurst: gesto verticale che accelera oltre 50 px resta trackpad', () => {
  let state = classifyWheelBurst({ deltaMode: PIXEL, deltaX: 0, deltaY: 3 }, 0, null);
  state = classifyWheelBurst({ deltaMode: PIXEL, deltaX: 0, deltaY: 80 }, 16, state);
  assert.equal(state.kind, 'trackpad');
});

test('classifyWheelBurst: raffica con delta misti mantiene una sola classificazione', () => {
  let state = classifyWheelBurst({ deltaMode: PIXEL, deltaX: 8, deltaY: 2 }, 0, null);
  assert.equal(state.kind, 'trackpad');

  // Evento successivo che, isolato, classificherebbe come rotella (deltaY grande), ma arriva
  // nella stessa raffica (meno di 100ms dopo) quindi eredita 'trackpad'.
  state = classifyWheelBurst({ deltaMode: PIXEL, deltaX: 0, deltaY: 60 }, 40, state);
  assert.equal(state.kind, 'trackpad');

  // Un gap superiore a 100ms chiude la raffica: la nuova classificazione si applica.
  state = classifyWheelBurst({ deltaMode: PIXEL, deltaX: 0, deltaY: 60 }, 250, state);
  assert.equal(state.kind, 'wheel');
});

test('wheelAction: rotella da sola ingrandisce, con Ctrl in verticale, con Alt in orizzontale', () => {
  assert.equal(wheelAction(NONE, 'wheel'), 'zoom');
  assert.equal(wheelAction(CTRL, 'wheel'), 'pan-y');
  assert.equal(wheelAction(ALT, 'wheel'), 'pan-x');
});

test('wheelAction: trackpad senza Ctrl sposta su due assi, con Ctrl (pinch) ingrandisce', () => {
  assert.equal(wheelAction(NONE, 'trackpad'), 'pan-xy');
  assert.equal(wheelAction(ALT, 'trackpad'), 'pan-xy');
  assert.equal(wheelAction(CTRL, 'trackpad'), 'zoom');
});

test('applyZoomDelta: progressione uniforme su più livelli di scala', () => {
  const k = 0.01;
  const afterOne = applyZoomDelta(1, -20, k);
  const afterTwo = applyZoomDelta(afterOne, -20, k);
  const ratioOne = afterOne / 1;
  const ratioTwo = afterTwo / afterOne;
  assert.ok(Math.abs(ratioOne - ratioTwo) < 1e-9, 'stesso delta deve produrre lo stesso rapporto a qualunque scala');
});

test('applyZoomDelta: ridimensiona a entrambi i limiti', () => {
  assert.equal(applyZoomDelta(BOARD_CONFIG.minZoom, 10000, 0.01), BOARD_CONFIG.minZoom);
  assert.equal(applyZoomDelta(BOARD_CONFIG.maxZoom, -10000, 0.01), BOARD_CONFIG.maxZoom);
});

test('zoomAtPoint: la coordinata mondo sotto il puntatore resta la stessa a più livelli', () => {
  const camera = { x: 3.4, y: 7.1 };
  const zoom = 1;
  const pointer = { x: 123, y: 456 };

  for (const nextZoom of [1.5, 2, 0.8, 3.9]) {
    const worldBefore = {
      x: camera.x + pointer.x / (BOARD_CONFIG.cellSize * zoom),
      y: camera.y + pointer.y / (BOARD_CONFIG.cellSize * zoom),
    };
    const nextCamera = zoomAtPoint(camera, zoom, nextZoom, pointer);
    const worldAfter = {
      x: nextCamera.x + pointer.x / (BOARD_CONFIG.cellSize * nextZoom),
      y: nextCamera.y + pointer.y / (BOARD_CONFIG.cellSize * nextZoom),
    };
    assert.ok(Math.abs(worldAfter.x - worldBefore.x) < 1e-9);
    assert.ok(Math.abs(worldAfter.y - worldBefore.y) < 1e-9);
  }
});

test('zoomAtPoint: invariante rispettata anche quando lo zoom viene ridimensionato ai limiti', () => {
  const camera = { x: 0, y: 0 };
  const zoom = 1;
  const pointer = { x: 200, y: 50 };
  const requestedZoom = 50; // fuori scala, il chiamante lo ridimensiona con clampZoom prima
  const appliedZoom = clampZoom(requestedZoom);

  const worldBefore = {
    x: camera.x + pointer.x / (BOARD_CONFIG.cellSize * zoom),
    y: camera.y + pointer.y / (BOARD_CONFIG.cellSize * zoom),
  };
  const nextCamera = zoomAtPoint(camera, zoom, appliedZoom, pointer);
  const worldAfter = {
    x: nextCamera.x + pointer.x / (BOARD_CONFIG.cellSize * appliedZoom),
    y: nextCamera.y + pointer.y / (BOARD_CONFIG.cellSize * appliedZoom),
  };
  assert.ok(Math.abs(worldAfter.x - worldBefore.x) < 1e-9);
  assert.ok(Math.abs(worldAfter.y - worldBefore.y) < 1e-9);
});

test('viewportPointToWorldCell: equivalente al comportamento precedente con camera intera', () => {
  const rect = { left: 0, top: 0 };
  const zoom = 1;
  const camera = { x: 5, y: 5 };
  const cell = viewportPointToWorldCell(
    BOARD_CONFIG.cellSize * 2 + 10,
    BOARD_CONFIG.cellSize * 3 + 10,
    rect,
    zoom,
    camera,
  );
  assert.deepEqual(cell, { x: 7, y: 8 });
});

test('viewportPointToWorldCell: cella corretta con camera a metà cella', () => {
  const rect = { left: 0, top: 0 };
  const zoom = 1;
  const camera = { x: 0.5, y: 0.5 };
  // Un punto appena dentro la prima cella (screen 10px) più mezza cella di camera resta
  // nella cella mondo 0, non 1.
  const cell = viewportPointToWorldCell(10, 10, rect, zoom, camera);
  assert.deepEqual(cell, { x: 0, y: 0 });
});

test('viewportPointToWorldCell: punto esattamente sul confine di cella', () => {
  const rect = { left: 0, top: 0 };
  const zoom = 1;
  const camera = { x: 0, y: 0 };
  const cell = viewportPointToWorldCell(BOARD_CONFIG.cellSize, BOARD_CONFIG.cellSize, rect, zoom, camera);
  assert.deepEqual(cell, { x: 1, y: 1 });
});

test('viewportPointToWorldCell: camera a zero', () => {
  const rect = { left: 0, top: 0 };
  const zoom = 1;
  const camera = { x: 0, y: 0 };
  const cell = viewportPointToWorldCell(5, 5, rect, zoom, camera);
  assert.deepEqual(cell, { x: 0, y: 0 });
});
