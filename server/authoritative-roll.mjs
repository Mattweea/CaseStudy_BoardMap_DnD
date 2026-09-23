import { randomUUID } from 'node:crypto';
import { resolveDiceRoll, SUPPORTED_DICE } from '../shared/dice-engine.mjs';
import { nextCryptoUint32 } from './dice-entropy.mjs';

const SUPPORTED_DICE_SET = new Set(SUPPORTED_DICE);
const MAX_DICE_COUNT = 20;
const MAX_MODIFIER = 1000;

export function parseRollFormula(value) {
  if (typeof value !== 'string') {
    return { error: 'Inserisci una formula nel formato NdS, ad esempio 1d20+5.' };
  }

  const match = value.trim().match(/^(\d{1,2})d(4|6|8|10|12|20|100)([+-]\d{1,4})?$/i);
  if (!match) {
    return { error: 'Formula non valida. Usa NdS con modificatore opzionale (es. 2d6-1).' };
  }

  const count = Number(match[1]);
  const sides = Number(match[2]);
  const modifier = Number(match[3] ?? 0);
  if (!SUPPORTED_DICE_SET.has(sides) || count < 1 || count > MAX_DICE_COUNT || Math.abs(modifier) > MAX_MODIFIER) {
    return { error: `Limiti: 1-${MAX_DICE_COUNT} dadi d4/d6/d8/d10/d12/d20/d100 e modificatore tra -${MAX_MODIFIER} e +${MAX_MODIFIER}.` };
  }

  return {
    formula: `${count}d${sides}${modifier === 0 ? '' : modifier > 0 ? `+${modifier}` : modifier}`,
    count,
    sides,
    modifier,
  };
}

export function createAuthoritativeRoll(user, request, {
  nextUint32 = nextCryptoUint32,
  createId = randomUUID,
  now = () => new Date().toISOString(),
} = {}) {
  const parsed = parseRollFormula(request?.formula);
  if (parsed.error) return parsed;

  const visibility = request?.visibility === 'secret' ? 'secret' : request?.visibility === 'public' ? 'public' : null;
  if (!visibility) return { error: 'Scegli se il tiro è pubblico o segreto.' };

  const mode = request?.mode === 'advantage' || request?.mode === 'disadvantage' ? request.mode : 'normal';
  if (mode !== 'normal' && (parsed.sides !== 20 || parsed.count !== 1)) {
    return { error: 'Vantaggio e svantaggio sono disponibili solo per 1d20.' };
  }

  const resolved = resolveDiceRoll({
    groups: [{ count: parsed.count, sides: parsed.sides, modifier: parsed.modifier }],
    mode,
  }, { nextUint32 });

  return {
    log: {
      id: createId(),
      label: parsed.formula,
      formula: parsed.formula,
      rollerName: user.displayName ?? user.username,
      authorUserId: user.id,
      timestamp: now(),
      rolls: resolved.rolls,
      keptRolls: resolved.keptRolls,
      total: resolved.total,
      modifier: resolved.modifier,
      mode,
      visibility,
      dice: resolved.dice,
    },
  };
}
