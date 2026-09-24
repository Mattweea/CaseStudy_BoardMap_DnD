import { randomUUID } from 'node:crypto';
import { resolveDiceRoll } from '../shared/dice-engine.mjs';
import { MAX_PRESENTATION_DICE } from '../shared/dice-3d-presentation.mjs';
import { nextCryptoUint32 } from './dice-entropy.mjs';

// Il tetto complessivo di dadi generati è ancorato a `MAX_PRESENTATION_DICE`: qualunque tiro
// accettato qui resta dentro il limite che la presentazione 3D sa già rendere, senza degradare
// al log numerico per un caso che il server avrebbe potuto rifiutare prima.
const MAX_TOTAL_DICE = MAX_PRESENTATION_DICE;
const MAX_GROUPS = 10;
const MAX_TOTAL_MODIFIER = 1000;

// "100" precede "10" nell'alternanza: un'estrazione non ancorata (TOKEN_RE) prende la prima
// alternativa che porta a un match, non la più lunga, e "1d100" verrebbe letto come "1d10"+"0"
// scartando la cifra residua se "10" venisse provato per primo.
const TERM_PATTERN = '(?:\\d{1,2}d(?:100|4|6|8|10|12|20)|\\d{1,4})';
const FULL_FORMULA_RE = new RegExp(`^[+-]?${TERM_PATTERN}(?:[+-]${TERM_PATTERN})*$`, 'i');
const TOKEN_RE = new RegExp(`[+-]?${TERM_PATTERN}`, 'gi');
const GROUP_TOKEN_RE = /^([+-]?)(\d{1,2})d(100|4|6|8|10|12|20)$/i;
const MODIFIER_TOKEN_RE = /^([+-]?)(\d{1,4})$/;

const GENERIC_ERROR = 'Formula non valida. Usa gruppi NdS e modificatori separati da + o -, ad esempio 1d8 + 3d6 - 1.';

function formatTerm(group, isFirst) {
  const signPrefix = group.sign === -1 ? '-' : isFirst ? '' : '+';
  const modifierSuffix = group.modifier === 0 ? '' : group.modifier > 0 ? `+${group.modifier}` : String(group.modifier);
  return `${signPrefix}${group.count}d${group.sides}${modifierSuffix}`;
}

function tokenizeFormula(raw) {
  const compact = raw.replace(/\s+/g, '');
  if (!compact || !FULL_FORMULA_RE.test(compact)) return null;
  return compact.match(TOKEN_RE);
}

/**
 * Scansiona la formula come una somma di termini firmati (`+`/`-`), invece di una regex
 * monolitica: ogni termine è un gruppo `NdS` oppure un modificatore intero, e un errore può
 * indicare quale termine o quale limite complessivo è stato violato.
 */
export function parseRollFormula(value) {
  if (typeof value !== 'string') {
    return { error: 'Inserisci una formula, ad esempio 1d20+5 o 1d8 + 3d6.' };
  }

  const tokens = tokenizeFormula(value);
  if (!tokens) return { error: GENERIC_ERROR };

  const groups = [];
  let modifierSum = 0;
  for (const token of tokens) {
    const groupMatch = token.match(GROUP_TOKEN_RE);
    if (groupMatch) {
      const sign = groupMatch[1] === '-' ? -1 : 1;
      const count = Number(groupMatch[2]);
      const sides = Number(groupMatch[3]);
      if (count < 1) return { error: `Il gruppo "${token}" richiede almeno un dado.` };
      groups.push({ sign, count, sides, modifier: 0 });
      continue;
    }
    const modifierMatch = token.match(MODIFIER_TOKEN_RE);
    if (!modifierMatch) return { error: GENERIC_ERROR };
    modifierSum += (modifierMatch[1] === '-' ? -1 : 1) * Number(modifierMatch[2]);
  }

  if (groups.length === 0) {
    return { error: 'La formula deve contenere almeno un gruppo di dadi, ad esempio 1d8.' };
  }
  if (groups.length > MAX_GROUPS) {
    return { error: `Limite di gruppi superato: massimo ${MAX_GROUPS} gruppi di dadi per tiro.` };
  }

  const hasD20 = groups.some((group) => group.sides === 20);
  if (hasD20 && groups.length > 1) {
    return { error: 'Il d20 si tira da solo: non può condividere una formula con altri gruppi di dadi.' };
  }

  if (Math.abs(modifierSum) > MAX_TOTAL_MODIFIER) {
    return { error: `Limite di modificatore superato: il modificatore complessivo deve restare tra -${MAX_TOTAL_MODIFIER} e +${MAX_TOTAL_MODIFIER}.` };
  }
  groups[0].modifier = modifierSum;

  const isSingleD20 = hasD20 && groups[0].count === 1;
  // Un 1d20 solitario ne genera due (coppia non risolta); ogni altro gruppo, incluso un Xd20
  // indipendente, genera esattamente i dadi scritti in formula.
  const generatedDiceCount = isSingleD20 ? 2 : groups.reduce((sum, group) => sum + group.count, 0);
  if (generatedDiceCount > MAX_TOTAL_DICE) {
    return { error: `Limite di dadi superato: un tiro può generare al massimo ${MAX_TOTAL_DICE} dadi complessivi.` };
  }

  return {
    formula: groups.map((group, index) => formatTerm(group, index === 0)).join(''),
    groups,
    isSingleD20,
  };
}

export function createAuthoritativeRoll(user, request, {
  nextUint32 = nextCryptoUint32,
  createId = randomUUID,
  now = () => new Date().toISOString(),
} = {}) {
  if (request?.mode !== undefined) {
    return { error: 'Il tiro libero non accetta una modalità: un d20 solitario genera sempre due esiti indipendenti, e chi legge il log scelga quale contare.' };
  }

  const parsed = parseRollFormula(request?.formula);
  if (parsed.error) return parsed;

  const visibility = request?.visibility === 'secret' ? 'secret' : request?.visibility === 'public' ? 'public' : null;
  if (!visibility) return { error: 'Scegli se il tiro è pubblico o segreto.' };

  const resolved = resolveDiceRoll({
    groups: parsed.groups,
    mode: parsed.isSingleD20 ? 'unresolved' : 'normal',
  }, { nextUint32 });

  const log = {
    id: createId(),
    label: parsed.formula,
    formula: parsed.formula,
    rollerName: user.displayName ?? user.username,
    authorUserId: user.id,
    timestamp: now(),
    rolls: resolved.rolls,
    keptRolls: resolved.keptRolls,
    total: resolved.aggregateTotal,
    modifier: resolved.modifier,
    mode: 'normal',
    visibility,
    dice: resolved.dice,
  };

  if (resolved.groups.length > 1) {
    log.parts = resolved.groups.map((group) => ({
      label: group.label,
      formula: group.formula,
      rolls: group.rolls,
      keptRolls: group.keptRolls,
      modifier: group.modifier,
      total: group.total,
    }));
  }

  return { log };
}
