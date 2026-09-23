import { SUPPORTED_DICE } from './dice-engine.mjs';

const SUPPORTED_DICE_SET = new Set(SUPPORTED_DICE);
const DISPOSITIONS = new Set(['kept', 'discarded', 'unresolved']);

export function normalizeDiceDetail(value) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length === 0) return undefined;

  const ids = new Set();
  const normalized = [];
  for (const die of value) {
    if (!die || typeof die !== 'object' || typeof die.id !== 'string' || !die.id ||
        ids.has(die.id) || !SUPPORTED_DICE_SET.has(die.sides) || !Number.isInteger(die.value) ||
        die.value < 1 || die.value > die.sides || typeof die.groupId !== 'string' || !die.groupId ||
        !DISPOSITIONS.has(die.disposition)) {
      return undefined;
    }
    ids.add(die.id);
    normalized.push({
      id: die.id,
      sides: die.sides,
      value: die.value,
      groupId: die.groupId,
      disposition: die.disposition,
    });
  }
  return normalized;
}

export function normalizeDiceLogDetail(log) {
  const { dice: rawDice, ...legacyFields } = log;
  const dice = normalizeDiceDetail(rawDice);
  return dice ? { ...legacyFields, dice } : legacyFields;
}
