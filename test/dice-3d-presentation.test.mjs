import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DicePresentationQueue,
  buildDicePresentation,
  canAnimateDice,
  collectDiceDeliveries,
  isDicePresentationSkipInput,
  percentileFaces,
} from '../shared/dice-3d-presentation.mjs';

function die(id, sides, value, groupId = 'group-1', disposition = 'kept') {
  return { id, sides, value, groupId, disposition };
}

function log(id, dice) {
  return { id, label: `Tiro ${id}`, formula: 'formula-irrilevante', dice };
}

test('costruisce la notazione soltanto dal dettaglio autorevole', () => {
  const input = log('roll-1', [die('die-1', 6, 2), die('die-2', 6, 5)]);
  const result = buildDicePresentation(input);
  assert.equal(result.ok, true);
  assert.equal(result.presentation.notation, '2d6@2,5');
  assert.deepEqual(result.presentation.visualDice.map(({ forcedValue }) => forcedValue), [2, 5]);
  assert.equal(input.formula, 'formula-irrilevante');
});

test('traduce tutti i casi percentile richiesti', () => {
  const cases = [
    [1, 100, 1, '01'],
    [7, 100, 7, '07'],
    [10, 10, 10, '10'],
    [40, 40, 10, '40'],
    [99, 90, 9, '99'],
    [100, 100, 10, '00'],
  ];
  for (const [value, tens, units, label] of cases) {
    assert.deepEqual(percentileFaces(value), { tens, units, label });
  }

  const result = buildDicePresentation(log('percentile', [die('die-1', 100, 7)]));
  assert.equal(result.ok, true);
  assert.equal(result.presentation.notation, '1d100+1d10@100,7');
});

test('una voce storica con un dado scartato resta presentabile e conserva la disposizione senza errori', () => {
  const result = buildDicePresentation(log('historic-advantage', [
    die('a', 20, 14, 'group-1', 'kept'),
    die('b', 20, 9, 'group-1', 'discarded'),
  ]));
  assert.equal(result.ok, true);
  assert.deepEqual(result.presentation.groups[0].dice.map(({ disposition }) => disposition), ['kept', 'discarded']);
});

test('preserva gruppi e disposizioni nella presentazione', () => {
  const result = buildDicePresentation(log('groups', [
    die('a', 20, 18, 'attack', 'kept'),
    die('b', 20, 4, 'attack', 'discarded'),
    die('c', 8, 7, 'damage-fire', 'unresolved'),
  ]));
  assert.equal(result.ok, true);
  assert.deepEqual(result.presentation.groups.map(({ id }) => id), ['attack', 'damage-fire']);
  assert.deepEqual(result.presentation.groups[0].dice.map(({ disposition }) => disposition), ['kept', 'discarded']);
  assert.equal(result.presentation.groups[1].dice[0].disposition, 'unresolved');
});

test('costruisce la notazione da un log con più tipi di dado e conserva i gruppi logici distinti', () => {
  const result = buildDicePresentation(log('mixed', [
    die('a', 8, 5, 'group-1'),
    die('b', 6, 2, 'group-2'),
    die('c', 6, 4, 'group-2'),
    die('d', 6, 6, 'group-2'),
  ]));
  assert.equal(result.ok, true);
  assert.equal(result.presentation.notation, '1d8+3d6@5,2,4,6');
  assert.deepEqual(result.presentation.groups.map(({ id }) => id), ['group-1', 'group-2']);
  assert.equal(result.presentation.groups[0].dice.length, 1);
  assert.equal(result.presentation.groups[1].dice.length, 3);
});

test('gruppi combinati oltre il limite degradano come un unico gruppo troppo grande', () => {
  const combined = [
    ...Array.from({ length: 11 }, (_, index) => die(`a-${index}`, 4, 1, 'group-1')),
    ...Array.from({ length: 10 }, (_, index) => die(`b-${index}`, 6, 1, 'group-2')),
  ];
  assert.equal(combined.length, 21);
  assert.deepEqual(buildDicePresentation(log('combined-over-limit', combined)), { ok: false, reason: 'too-many-dice' });
});

test('degrada l intera voce per dettaglio assente, malformato, duplicato o oltre limite', () => {
  assert.deepEqual(buildDicePresentation({ id: 'legacy' }), { ok: false, reason: 'missing-dice' });
  assert.equal(buildDicePresentation(log('invalid', [die('x', 6, 7)])).ok, false);
  assert.equal(buildDicePresentation(log('duplicate', [die('x', 6, 1), die('x', 6, 2)])).ok, false);
  assert.deepEqual(
    buildDicePresentation(log('large', Array.from({ length: 21 }, (_, index) => die(`d-${index}`, 6, 1)))),
    { ok: false, reason: 'too-many-dice' },
  );
});

test('venti d100 restano venti dadi logici e diventano quaranta modelli in due set', () => {
  const result = buildDicePresentation(log(
    'percentile-cap',
    Array.from({ length: 20 }, (_, index) => die(`d-${index}`, 100, index + 1)),
  ));
  assert.equal(result.ok, true);
  assert.equal(result.presentation.visualDice.length, 40);
  assert.match(result.presentation.notation, /^20d100\+20d10@/);
  assert.equal(result.presentation.notation.split('@')[1].split(',').length, 40);
});

test('la baseline e gli snapshot live producono consegne una volta e in ordine cronologico', () => {
  const seen = new Set();
  assert.deepEqual(collectDiceDeliveries([log('old-2'), log('old-1')], seen, { baseline: true }), []);
  assert.deepEqual(collectDiceDeliveries([log('new-2'), log('new-1'), log('old-2')], seen).map(({ id }) => id), ['new-1', 'new-2']);
  assert.deepEqual(collectDiceDeliveries([log('new-2')], seen), []);
  assert.deepEqual(collectDiceDeliveries([], seen), []);
  assert.deepEqual(collectDiceDeliveries([log('new-2'), log('old-2')], seen, { baseline: true }), []);
});

test('la coda serializza, deduplica e prosegue dopo un errore', async () => {
  const events = [];
  const errors = [];
  const queue = new DicePresentationQueue({
    timeoutMs: 50,
    run: async ({ id }) => {
      events.push(`start:${id}`);
      if (id === 'first') throw new Error('renderer');
      await Promise.resolve();
      events.push(`end:${id}`);
    },
    onError: (_error, item) => errors.push(item.id),
  });
  queue.enqueue([log('first'), log('second'), log('second')]);
  await queue.whenIdle();
  assert.deepEqual(events, ['start:first', 'start:second', 'end:second']);
  assert.deepEqual(errors, ['first']);
});

test('la coda supera anche un timeout', async () => {
  const completed = [];
  const queue = new DicePresentationQueue({
    timeoutMs: 5,
    run: ({ id }) => id === 'stuck' ? new Promise(() => {}) : completed.push(id),
  });
  queue.enqueue([log('stuck'), log('next')]);
  await queue.whenIdle();
  assert.deepEqual(completed, ['next']);
});

test('lo scarto rimuove solo i pendenti e ne conserva la deduplica', async () => {
  const events = [];
  let releaseCurrent;
  const queue = new DicePresentationQueue({
    run: ({ id }) => {
      events.push(id);
      if (id === 'current') return new Promise((resolve) => { releaseCurrent = resolve; });
      return undefined;
    },
  });
  queue.enqueue([log('current'), log('pending-1'), log('pending-2')]);
  await Promise.resolve();
  assert.deepEqual(queue.discardPending().map(({ id }) => id), ['pending-1', 'pending-2']);
  releaseCurrent();
  await queue.whenIdle();
  queue.enqueue([log('pending-1'), log('future')]);
  await queue.whenIdle();
  assert.deepEqual(events, ['current', 'future']);
});

test('un errore fatale disabilita il renderer ma drena i tiri successivi senza mutare i log', async () => {
  const original = [log('broken', [die('a', 6, 3)]), log('fallback', [die('b', 8, 5)])];
  const snapshot = structuredClone(original);
  let rendererDisabled = false;
  const attempted = [];
  const queue = new DicePresentationQueue({
    run: ({ id }) => {
      if (rendererDisabled) return;
      attempted.push(id);
      throw new Error('webgl-context-lost');
    },
    onError: () => {
      rendererDisabled = true;
    },
  });

  queue.enqueue(original);
  await queue.whenIdle();
  assert.equal(rendererDisabled, true);
  assert.deepEqual(attempted, ['broken']);
  assert.deepEqual(original, snapshot);
});

test('la capability rispetta movimento ridotto e disponibilita WebGL', () => {
  const canvas = (contexts) => ({ getContext: (kind) => contexts.includes(kind) ? {} : null });
  assert.equal(canAnimateDice({ reducedMotion: true, createCanvas: () => canvas(['webgl']) }), false);
  assert.equal(canAnimateDice({ reducedMotion: false, createCanvas: () => canvas([]) }), false);
  assert.equal(canAnimateDice({ reducedMotion: false, createCanvas: () => canvas(['webgl2']) }), true);
});

test('riconosce soltanto click primario ed Escape come comandi di salto', () => {
  assert.equal(isDicePresentationSkipInput({ type: 'click', button: 0 }), true);
  assert.equal(isDicePresentationSkipInput({ type: 'click', button: 1 }), false);
  assert.equal(isDicePresentationSkipInput({ type: 'contextmenu', button: 2 }), false);
  assert.equal(isDicePresentationSkipInput({ type: 'keydown', key: 'Escape' }), true);
  assert.equal(isDicePresentationSkipInput({ type: 'keydown', key: 'Enter' }), false);
  assert.equal(isDicePresentationSkipInput(null), false);
});
