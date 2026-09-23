import assert from 'node:assert/strict';
import test from 'node:test';
import { canPlayDiceSound, DiceRollAudioController } from '../shared/dice-roll-audio.mjs';

test('abilita il suono soltanto con preferenza e gesto utente', () => {
  assert.equal(canPlayDiceSound({ soundEnabled: true, userActivated: true }), true);
  assert.equal(canPlayDiceSound({ soundEnabled: false, userActivated: true }), false);
  assert.equal(canPlayDiceSound({ soundEnabled: true, userActivated: false }), false);
});

test('programma la sequenza e stop cancella timer e audio attivi', async () => {
  const scheduled = [];
  const cancelled = [];
  const audioInstances = [];
  const controller = new DiceRollAudioController({
    cues: [
      { delayMs: 0, src: 'first.mp3', volume: 0.3 },
      { delayMs: 100, src: 'second.mp3', volume: 0.2 },
    ],
    schedule: (callback, delayMs) => {
      const timer = { callback, delayMs };
      scheduled.push(timer);
      return timer;
    },
    cancelSchedule: (timer) => cancelled.push(timer),
    createAudio: (src) => {
      const audio = { src, currentTime: 4, pauseCalls: 0, play: () => Promise.resolve(), pause() { this.pauseCalls += 1; }, addEventListener() {} };
      audioInstances.push(audio);
      return audio;
    },
  });

  assert.equal(controller.start({ soundEnabled: true, userActivated: true }), true);
  assert.deepEqual(scheduled.map(({ delayMs }) => delayMs), [0, 100]);
  scheduled[0].callback();
  assert.equal(audioInstances[0].src, 'first.mp3');
  assert.equal(audioInstances[0].volume, 0.3);
  controller.stop();
  assert.deepEqual(cancelled, [scheduled[1]]);
  assert.equal(audioInstances[0].pauseCalls, 1);
  assert.equal(audioInstances[0].currentTime, 0);
});

test('non programma audio senza gate e isola errori sincroni o rejection', async () => {
  let schedules = 0;
  const silent = new DiceRollAudioController({
    schedule: () => { schedules += 1; },
    cancelSchedule: () => {},
    createAudio: () => null,
  });
  assert.equal(silent.start({ soundEnabled: true, userActivated: false }), false);
  assert.equal(schedules, 0);

  const callbacks = [];
  const failing = new DiceRollAudioController({
    cues: [{ delayMs: 0, src: 'missing.mp3', volume: 1 }],
    schedule: (callback) => { callbacks.push(callback); return callback; },
    cancelSchedule: () => {},
    createAudio: () => ({ play: () => Promise.reject(new Error('blocked')), addEventListener() {} }),
  });
  assert.equal(failing.start({ soundEnabled: true, userActivated: true }), true);
  assert.doesNotThrow(() => callbacks[0]());
  await Promise.resolve();

  const throwing = new DiceRollAudioController({
    cues: [{ delayMs: 0, src: 'broken.mp3', volume: 1 }],
    schedule: (callback) => { callbacks.push(callback); return callback; },
    cancelSchedule: () => {},
    createAudio: () => { throw new Error('unsupported'); },
  });
  throwing.start({ soundEnabled: true, userActivated: true });
  assert.doesNotThrow(() => callbacks.at(-1)());
});
