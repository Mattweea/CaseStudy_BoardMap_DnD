export const SUPPORTED_DICE = Object.freeze([4, 6, 8, 10, 12, 20, 100]);

const SUPPORTED_DICE_SET = new Set(SUPPORTED_DICE);
const UINT32_RANGE = 0x1_0000_0000;

function assertNextUint32(nextUint32) {
  if (typeof nextUint32 !== 'function') {
    throw new TypeError('nextUint32 must be a function');
  }
}

function assertUint32(value) {
  if (!Number.isInteger(value) || value < 0 || value >= UINT32_RANGE) {
    throw new RangeError('The entropy source must return an unsigned 32-bit integer');
  }
}

/**
 * Samples an exact discrete uniform value in {1, ..., sides}. Values in the
 * incomplete tail of the uint32 domain are rejected instead of folded with `%`.
 */
export function rollUniformDie(sides, nextUint32) {
  if (!SUPPORTED_DICE_SET.has(sides)) {
    throw new RangeError(`Unsupported die: d${sides}`);
  }
  assertNextUint32(nextUint32);

  const limit = UINT32_RANGE - (UINT32_RANGE % sides);
  while (true) {
    const value = nextUint32();
    assertUint32(value);
    if (value < limit) return (value % sides) + 1;
  }
}

function normalizeGroup(group, index) {
  const count = group?.count;
  const sides = group?.sides;
  const modifier = group?.modifier ?? 0;
  const sign = group?.sign ?? 1;
  if (!Number.isInteger(count) || count < 1 || !SUPPORTED_DICE_SET.has(sides) ||
      !Number.isFinite(modifier) || (sign !== 1 && sign !== -1)) {
    throw new RangeError(`Invalid dice group at index ${index}`);
  }
  return { count, sides, modifier, sign, label: typeof group.label === 'string' ? group.label : undefined };
}

function formulaFor({ count, sides, modifier, sign = 1 }) {
  const suffix = modifier === 0 ? '' : modifier > 0 ? `+${modifier}` : String(modifier);
  return `${sign === -1 ? '-' : ''}${count}d${sides}${suffix}`;
}

function resolveGroup(group, mode, nextUint32, groupIndex, dieOffset) {
  const groupId = `group-${groupIndex + 1}`;
  const generatedCount = mode === 'advantage' || mode === 'disadvantage' || mode === 'unresolved'
    ? 2
    : group.count;
  const values = Array.from({ length: generatedCount }, () => rollUniformDie(group.sides, nextUint32));

  let keptIndex = null;
  if (mode === 'advantage') keptIndex = values[1] > values[0] ? 1 : 0;
  if (mode === 'disadvantage') keptIndex = values[1] < values[0] ? 1 : 0;

  const dice = values.map((value, index) => ({
    id: `die-${dieOffset + index + 1}`,
    sides: group.sides,
    value,
    groupId,
    disposition: mode === 'unresolved'
      ? 'unresolved'
      : keptIndex === null || keptIndex === index ? 'kept' : 'discarded',
  }));
  const keptRolls = mode === 'unresolved'
    ? [values[0]]
    : keptIndex === null ? values : [values[keptIndex]];

  return {
    groupId,
    label: group.label,
    formula: formulaFor({ ...group, count: mode === 'normal' ? group.count : 1 }),
    rolls: values,
    keptRolls,
    modifier: group.modifier,
    sign: group.sign,
    total: keptRolls.reduce((sum, value) => sum + value, 0) * group.sign + group.modifier,
    dice,
  };
}

/**
 * Single entry point for logical dice resolution.
 *
 * Probability models:
 * - 1dS: P(X=k)=1/S, E[X]=(S+1)/2, Var(X)=(S^2-1)/12.
 * - NdS: sum of N independent 1dS variables; means and variances add.
 * - advantage/disadvantage: max/min of two independent d20 values.
 * - unresolved: two independent d20 values with selection deliberately deferred.
 *
 * `formula`, `rolls`, `keptRolls`, `modifier` and `total` describe only `groups[0]`; a caller
 * that passes several groups must read `aggregateTotal` (or `groups`) for the whole roll.
 */
export function resolveDiceRoll({ groups, mode = 'normal' }, { nextUint32 }) {
  assertNextUint32(nextUint32);
  if (!Array.isArray(groups) || groups.length === 0) {
    throw new RangeError('At least one dice group is required');
  }
  if (!['normal', 'advantage', 'disadvantage', 'unresolved'].includes(mode)) {
    throw new RangeError(`Unsupported roll mode: ${mode}`);
  }

  const normalizedGroups = groups.map(normalizeGroup);
  if (mode !== 'normal' &&
      (normalizedGroups.length !== 1 || normalizedGroups[0].count !== 1 || normalizedGroups[0].sides !== 20)) {
    throw new RangeError(`${mode} is available only for one d20`);
  }

  let dieOffset = 0;
  const resolvedGroups = normalizedGroups.map((group, index) => {
    const resolved = resolveGroup(group, mode, nextUint32, index, dieOffset);
    dieOffset += resolved.dice.length;
    return resolved;
  });
  // I campi legacy sotto (`formula`, `rolls`, `keptRolls`, `modifier`, `total`) descrivono
  // soltanto il primo gruppo, per compatibilità con i chiamanti esistenti (tiro libero a gruppo
  // singolo, bersagli della scheda). `aggregateTotal` è il totale del tiro intero, gruppi
  // multipli compresi, e rispetta il segno di ciascun gruppo.
  const primary = resolvedGroups[0];
  const aggregateTotal = resolvedGroups.reduce((sum, group) => sum + group.total, 0);

  return {
    formula: primary.formula,
    rolls: primary.rolls,
    keptRolls: primary.keptRolls,
    modifier: primary.modifier,
    total: primary.total,
    aggregateTotal,
    dice: resolvedGroups.flatMap((group) => group.dice),
    groups: resolvedGroups,
  };
}

export function singleDieModel(sides) {
  if (!SUPPORTED_DICE_SET.has(sides)) throw new RangeError(`Unsupported die: d${sides}`);
  return { probability: 1 / sides, mean: (sides + 1) / 2, variance: (sides ** 2 - 1) / 12 };
}

export function sumDiceModel(count, sides) {
  if (!Number.isInteger(count) || count < 1) throw new RangeError('count must be a positive integer');
  const single = singleDieModel(sides);
  return { mean: count * single.mean, variance: count * single.variance };
}

export function advantageProbability(value) {
  return value >= 1 && value <= 20 ? (2 * value - 1) / 400 : 0;
}

export function disadvantageProbability(value) {
  return value >= 1 && value <= 20 ? (41 - 2 * value) / 400 : 0;
}

export function successProbability(dc, modifier = 0, mode = 'normal') {
  const normal = Math.max(0, Math.min(1, (21 - (dc - modifier)) / 20));
  if (mode === 'advantage') return 1 - (1 - normal) ** 2;
  if (mode === 'disadvantage') return normal ** 2;
  return normal;
}

export function criticalProbability(threshold) {
  return Math.max(0, Math.min(1, (21 - threshold) / 20));
}
