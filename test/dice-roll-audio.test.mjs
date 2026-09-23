import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CANNON_SLEEPY,
  canPlayDiceSound,
  DICE_IMPACT_SAMPLES,
  DICE_ROLL_OPENING_CUES,
  diceLookStill,
  DiceRollAudioController,
} from '../shared/dice-roll-audio.mjs';

// Orologio e scheduler finti: il controller programma all'infinito, quindi il test deve poter
// avanzare di un numero di passi deciso da lui e poi fermare la raffica.
function createHarness({ random = () => 0.5, ...options } = {}) {
  let clock = 0;
  const pending = new Map();
  const played = [];
  const audioInstances = [];
  let nextId = 1;

  const controller = new DiceRollAudioController({
    now: () => clock,
    random,
    schedule: (callback, delayMs) => {
      const id = nextId;
      nextId += 1;
      pending.set(id, { callback, at: clock + delayMs });
      return id;
    },
    cancelSchedule: (id) => pending.delete(id),
    createAudio: (src) => {
      const audio = {
        src,
        volume: 0,
        currentTime: 4,
        pauseCalls: 0,
        loadCalls: 0,
        listeners: {},
        load() {
          this.loadCalls += 1;
        },
        play() {
          played.push({ src: this.src, volume: this.volume, at: clock });
          return Promise.resolve();
        },
        pause() {
          this.pauseCalls += 1;
        },
        addEventListener(type, listener) {
          this.listeners[type] = listener;
        },
      };
      audioInstances.push(audio);
      return audio;
    },
    ...options,
  });

  // Esegue il prossimo timer in ordine cronologico, portando avanti l'orologio finto.
  const step = () => {
    if (pending.size === 0) return false;
    const [id, entry] = [...pending.entries()].sort((a, b) => a[1].at - b[1].at)[0];
    pending.delete(id);
    clock = entry.at;
    entry.callback();
    return true;
  };

  return {
    controller,
    played,
    audioInstances,
    step,
    run: (steps) => {
      for (let i = 0; i < steps; i += 1) if (!step()) break;
    },
    // Come in un browser reale ogni campione finisce prima del successivo, cosi' il tetto di
    // sorgenti simultanee non interferisce con i test su densita' e volume.
    runReleasing: (steps) => {
      for (let i = 0; i < steps; i += 1) {
        if (!step()) break;
        for (const audio of audioInstances) audio.listeners.ended?.();
      }
    },
    endAll: () => {
      for (const audio of audioInstances) audio.listeners.ended?.();
    },
    pendingCount: () => pending.size,
    clock: () => clock,
  };
}

test('abilita il suono soltanto con preferenza e gesto utente', () => {
  assert.equal(canPlayDiceSound({ soundEnabled: true, userActivated: true }), true);
  assert.equal(canPlayDiceSound({ soundEnabled: false, userActivated: true }), false);
  assert.equal(canPlayDiceSound({ soundEnabled: true, userActivated: false }), false);
});

test('i dadi risultano fermi gia a SLEEPY, senza attendere SLEEPING', () => {
  const die = (sleepState) => ({ body: { sleepState } });
  const SLEEPING = CANNON_SLEEPY + 1;

  // Il caso che conta: e' questo l'istante in cui l'occhio li vede gia' fermi.
  assert.equal(diceLookStill([die(CANNON_SLEEPY), die(SLEEPING)]), true);
  assert.equal(diceLookStill([die(SLEEPING), die(SLEEPING)]), true);

  // Un solo dado ancora in moto tiene viva la raffica.
  assert.equal(diceLookStill([die(SLEEPING), die(0)]), false);
  assert.equal(diceLookStill([die(0)]), false);
});

test('diceLookStill non scambia una scena vuota o malformata per quiete', () => {
  // Una lista vuota vuol dire che i dadi non sono ancora comparsi, non che si sono fermati.
  assert.equal(diceLookStill([]), false);
  assert.equal(diceLookStill(undefined), false);
  assert.equal(diceLookStill(null), false);
  assert.equal(diceLookStill({ length: 2 }), false);
  // Forma inattesa: meglio lasciar chiudere la raffica alla rete di sicurezza.
  assert.equal(diceLookStill([{}]), false);
  assert.equal(diceLookStill([{ body: {} }]), false);
  assert.equal(diceLookStill([{ body: { sleepState: 'sleeping' } }]), false);
});

test('la raffica continua finche stop non arriva, senza coda finita', () => {
  const harness = createHarness();
  assert.equal(harness.controller.start({ soundEnabled: true, userActivated: true }), true);

  // Le cue di apertura sono programmate insieme al primo impatto dello scatter.
  assert.equal(harness.pendingCount(), DICE_ROLL_OPENING_CUES.length + 1);

  for (let i = 0; i < 60; i += 1) {
    harness.step();
    harness.endAll();
    // Dopo ogni impatto ne resta sempre almeno uno programmato: la raffica non si esaurisce.
    assert.ok(harness.pendingCount() >= 1, `raffica esaurita al passo ${i}`);
  }

  assert.ok(harness.clock() > 1800, 'la raffica deve coprire tutta la durata del tiro');
  assert.ok(harness.played.length > 20, `impatti insufficienti: ${harness.played.length}`);

  harness.controller.stop();
  assert.equal(harness.pendingCount(), 0);
});

test('densita e volume calano mentre i dadi si assestano', () => {
  const harness = createHarness();
  harness.controller.start({ soundEnabled: true, userActivated: true });
  harness.runReleasing(80);

  const impacts = harness.played.filter((entry) => entry.at >= 150);
  const gaps = impacts.slice(1).map((entry, index) => entry.at - impacts[index].at);
  const early = gaps.slice(0, 5);
  const late = gaps.slice(-5);
  assert.ok(
    Math.max(...early) < Math.min(...late),
    `gli intervalli devono allargarsi: ${early} contro ${late}`,
  );
  assert.ok(
    impacts.at(-1).volume < impacts[0].volume,
    'il volume degli impatti deve calare verso la fine',
  );
});

test('piu dadi producono una raffica piu fitta', () => {
  const single = createHarness();
  single.controller.start({ soundEnabled: true, userActivated: true, diceCount: 1 });
  single.run(40);
  single.endAll();

  const many = createHarness();
  many.controller.start({ soundEnabled: true, userActivated: true, diceCount: 12 });
  many.run(40);
  many.endAll();

  assert.ok(
    many.clock() < single.clock(),
    `12 dadi devono comprimere gli stessi impatti: ${many.clock()} contro ${single.clock()}`,
  );
});

test('il tetto di sorgenti simultanee evita accumulo', () => {
  const harness = createHarness();
  harness.controller.start({ soundEnabled: true, userActivated: true });
  // Nessun campione termina: senza tetto le sorgenti crescerebbero a ogni impatto.
  harness.run(40);
  assert.equal(harness.controller.activeAudio.size, harness.controller.scatter.maxConcurrent);
});

test('stop ferma la raffica e azzera i campioni attivi', () => {
  const harness = createHarness();
  harness.controller.start({ soundEnabled: true, userActivated: true });
  harness.run(6);

  const active = [...harness.controller.activeAudio];
  assert.ok(active.length > 0);
  harness.controller.stop();

  assert.equal(harness.pendingCount(), 0);
  assert.equal(harness.controller.activeAudio.size, 0);
  for (const audio of active) {
    assert.equal(audio.pauseCalls, 1);
    assert.equal(audio.currentTime, 0);
  }

  // Dopo lo stop nessun impatto residuo puo riprogrammarsi.
  harness.controller.emitImpact();
  assert.equal(harness.pendingCount(), 0);
});

test('settle chiude la raffica ma lascia spegnere i campioni gia partiti', () => {
  const harness = createHarness();
  harness.controller.start({ soundEnabled: true, userActivated: true });
  harness.run(6);

  const active = [...harness.controller.activeAudio];
  assert.ok(active.length > 0);
  harness.controller.settle();

  // Niente altri impatti programmati: i dadi sono fermi.
  assert.equal(harness.pendingCount(), 0);
  // Ma l'ultimo colpo non viene troncato.
  assert.equal(harness.controller.activeAudio.size, active.length);
  for (const audio of active) {
    assert.equal(audio.pauseCalls, 0);
    assert.equal(audio.currentTime, 4);
  }

  const playedAtSettle = harness.played.length;
  harness.controller.emitImpact();
  assert.equal(harness.played.length, playedAtSettle, 'nessun impatto dopo settle');
  assert.equal(harness.pendingCount(), 0);

  // I campioni si liberano da soli quando finiscono, senza bisogno di stop().
  harness.endAll();
  assert.equal(harness.controller.activeAudio.size, 0);
});

test('stop dopo settle resta sicuro e silenzia il residuo', () => {
  const harness = createHarness();
  harness.controller.start({ soundEnabled: true, userActivated: true });
  harness.run(6);
  harness.controller.settle();

  const active = [...harness.controller.activeAudio];
  harness.controller.stop();
  assert.equal(harness.controller.activeAudio.size, 0);
  for (const audio of active) assert.equal(audio.pauseCalls, 1);
});

test('start reimposta la raffica precedente invece di sovrapporla', () => {
  const harness = createHarness();
  harness.controller.start({ soundEnabled: true, userActivated: true });
  harness.run(10);
  harness.controller.start({ soundEnabled: true, userActivated: true });
  assert.equal(harness.pendingCount(), DICE_ROLL_OPENING_CUES.length + 1);
});

test('prime carica ogni campione una sola volta', () => {
  const harness = createHarness();
  harness.controller.prime();
  const sources = new Set(harness.audioInstances.map((audio) => audio.src));
  const expected = new Set([
    ...DICE_ROLL_OPENING_CUES.map((cue) => cue.src),
    ...DICE_IMPACT_SAMPLES,
  ]);
  assert.deepEqual(sources, expected);
  assert.equal(harness.audioInstances.length, expected.size);
  assert.ok(harness.audioInstances.every((audio) => audio.loadCalls === 1));
});

test('non programma audio senza gate e isola errori sincroni o rejection', async () => {
  let schedules = 0;
  const silent = new DiceRollAudioController({
    schedule: () => {
      schedules += 1;
    },
    cancelSchedule: () => {},
    createAudio: () => null,
  });
  assert.equal(silent.start({ soundEnabled: true, userActivated: false }), false);
  assert.equal(schedules, 0);

  const callbacks = [];
  const failing = new DiceRollAudioController({
    cues: [{ delayMs: 0, src: 'missing.mp3', volume: 1 }],
    schedule: (callback) => {
      callbacks.push(callback);
      return callback;
    },
    cancelSchedule: () => {},
    createAudio: () => ({ play: () => Promise.reject(new Error('blocked')), addEventListener() {} }),
  });
  assert.equal(failing.start({ soundEnabled: true, userActivated: true }), true);
  assert.doesNotThrow(() => callbacks[0]());
  await Promise.resolve();

  const throwing = new DiceRollAudioController({
    cues: [{ delayMs: 0, src: 'broken.mp3', volume: 1 }],
    schedule: (callback) => {
      callbacks.push(callback);
      return callback;
    },
    cancelSchedule: () => {},
    createAudio: () => {
      throw new Error('unsupported');
    },
  });
  throwing.start({ soundEnabled: true, userActivated: true });
  assert.doesNotThrow(() => callbacks.at(-1)());
});
