import { SUPPORTED_DICE } from './dice-engine.mjs';

export const MAX_PRESENTATION_DICE = 20;

const SUPPORTED_DICE_SET = new Set(SUPPORTED_DICE);
const DISPOSITIONS = new Set(['kept', 'discarded', 'unresolved']);

export function percentileFaces(value) {
  if (!Number.isInteger(value) || value < 1 || value > 100) {
    throw new RangeError('Il risultato percentile deve essere compreso fra 1 e 100.');
  }

  if (value === 100) return { tens: 100, units: 10, label: '00' };

  const tensDigit = Math.floor(value / 10);
  const unitsDigit = value % 10;
  return {
    tens: tensDigit === 0 ? 100 : tensDigit * 10,
    units: unitsDigit === 0 ? 10 : unitsDigit,
    label: String(value).padStart(2, '0'),
  };
}

function invalid(reason) {
  return { ok: false, reason };
}

function validateDie(die, ids) {
  if (!die || typeof die !== 'object') return false;
  if (typeof die.id !== 'string' || !die.id || ids.has(die.id)) return false;
  if (!SUPPORTED_DICE_SET.has(die.sides)) return false;
  if (!Number.isInteger(die.value) || die.value < 1 || die.value > die.sides) return false;
  if (typeof die.groupId !== 'string' || !die.groupId) return false;
  if (!DISPOSITIONS.has(die.disposition)) return false;
  ids.add(die.id);
  return true;
}

export function buildDicePresentation(log) {
  if (!log || typeof log !== 'object' || typeof log.id !== 'string' || !log.id) {
    return invalid('invalid-log');
  }
  if (!Array.isArray(log.dice) || log.dice.length === 0) return invalid('missing-dice');
  if (log.dice.length > MAX_PRESENTATION_DICE) return invalid('too-many-dice');

  const ids = new Set();
  if (!log.dice.every((die) => validateDie(die, ids))) return invalid('invalid-dice');

  const visualDice = [];
  const groupMap = new Map();

  for (const die of log.dice) {
    let group = groupMap.get(die.groupId);
    if (!group) {
      group = { id: die.groupId, dice: [] };
      groupMap.set(die.groupId, group);
    }

    const label = die.sides === 100
      ? percentileFaces(die.value).label
      : String(die.value);
    group.dice.push({
      id: die.id,
      sides: die.sides,
      value: die.value,
      label,
      disposition: die.disposition,
    });

    if (die.sides === 100) {
      const percentile = percentileFaces(die.value);
      visualDice.push(
        { logicalDieId: die.id, type: 'd100', forcedValue: percentile.tens },
        { logicalDieId: die.id, type: 'd10', forcedValue: percentile.units },
      );
    } else {
      visualDice.push({ logicalDieId: die.id, type: `d${die.sides}`, forcedValue: die.value });
    }
  }

  const diceByType = new Map();
  for (const visualDie of visualDice) {
    const group = diceByType.get(visualDie.type) ?? [];
    group.push(visualDie);
    diceByType.set(visualDie.type, group);
  }
  const rendererDice = [...diceByType.values()].flat();
  const notation = `${[...diceByType.entries()]
    .map(([type, dice]) => `${dice.length}${type}`)
    .join('+')}@${rendererDice
    .map((die) => die.forcedValue)
    .join(',')}`;

  return {
    ok: true,
    presentation: {
      logId: log.id,
      label: typeof log.label === 'string' && log.label ? log.label : 'Tiro di dadi',
      notation,
      visualDice: rendererDice,
      groups: [...groupMap.values()],
    },
  };
}

export function collectDiceDeliveries(logs, seenIds, { baseline = false } = {}) {
  if (!Array.isArray(logs)) return [];

  const deliveries = [];
  for (const log of logs) {
    if (!log || typeof log.id !== 'string' || !log.id || seenIds.has(log.id)) continue;
    seenIds.add(log.id);
    if (!baseline) deliveries.push(log);
  }

  return deliveries.reverse();
}

function withTimeout(promise, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('dice-presentation-timeout')), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export class DicePresentationQueue {
  constructor({ run, timeoutMs = 15_000, onError = () => {} }) {
    this.run = run;
    this.timeoutMs = timeoutMs;
    this.onError = onError;
    this.items = [];
    this.seenIds = new Set();
    this.running = false;
    this.idleWaiters = [];
  }

  enqueue(logs) {
    for (const log of logs) {
      if (!log || typeof log.id !== 'string' || !log.id || this.seenIds.has(log.id)) continue;
      this.seenIds.add(log.id);
      this.items.push(log);
    }
    void this.drain();
  }

  discardPending() {
    const discarded = this.items.splice(0);
    if (!this.running) {
      for (const resolve of this.idleWaiters.splice(0)) resolve();
    }
    return discarded;
  }

  async drain() {
    if (this.running) return;
    this.running = true;
    while (this.items.length > 0) {
      const item = this.items.shift();
      try {
        await withTimeout(Promise.resolve(this.run(item)), this.timeoutMs);
      } catch (error) {
        this.onError(error, item);
      }
    }
    this.running = false;
    for (const resolve of this.idleWaiters.splice(0)) resolve();
  }

  whenIdle() {
    if (!this.running && this.items.length === 0) return Promise.resolve();
    return new Promise((resolve) => this.idleWaiters.push(resolve));
  }
}

export function canAnimateDice({ reducedMotion, createCanvas }) {
  if (reducedMotion) return false;
  try {
    const canvas = createCanvas();
    return Boolean(
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl'),
    );
  } catch {
    return false;
  }
}

export function isDicePresentationSkipInput(input) {
  if (!input || typeof input !== 'object') return false;
  if (input.type === 'click') return input.button === 0;
  return input.type === 'keydown' && input.key === 'Escape';
}
