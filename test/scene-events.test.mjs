import assert from 'node:assert/strict';
import test from 'node:test';
import { eventBelongsToActiveScene } from '../src/utils/sceneEvents.ts';

test('scene-aware client events accept only the current active scene', () => {
  assert.equal(eventBelongsToActiveScene({ sceneId: 'scene-new' }, 'scene-new'), true);
  assert.equal(eventBelongsToActiveScene({ sceneId: 'scene-old' }, 'scene-new'), false);
  assert.equal(eventBelongsToActiveScene({}, 'scene-new'), false);
  assert.equal(eventBelongsToActiveScene({ sceneId: 'scene-new' }, null), false);
});
