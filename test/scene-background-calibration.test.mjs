import assert from 'node:assert/strict';
import test from 'node:test';
import { sceneBackgroundViewportTransform } from '../shared/scene-background-calibration.mjs';

test('background calibration composes signed offsets, camera pan and zoom in one viewport transform', () => {
  const calibration = { scale: 1.25, offsetX: -24, offsetY: 72 };

  assert.deepEqual(
    sceneBackgroundViewportTransform(calibration, { x: 0, y: 0 }, 1, 48),
    { translateX: -24, translateY: 72, scale: 1.25 },
  );
  assert.deepEqual(
    sceneBackgroundViewportTransform(calibration, { x: 3, y: 2 }, 2, 48),
    { translateX: -336, translateY: -48, scale: 2.5 },
  );
});

test('normal and fullscreen viewports produce the same transform for the same camera and zoom', () => {
  const calibration = { scale: 0.8, offsetX: 120, offsetY: -36 };
  const normal = sceneBackgroundViewportTransform(calibration, { x: 4, y: 5 }, 1.5, 48);
  const fullscreen = sceneBackgroundViewportTransform(calibration, { x: 4, y: 5 }, 1.5, 48);

  assert.deepEqual(fullscreen, normal);
});
