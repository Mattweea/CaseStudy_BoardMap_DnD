// Motore dei tiri della scheda (P0.5 Fase B): ricostruisce sul server la formula di un
// bersaglio `data-roll-source` dallo stato live della scheda, riusando il generatore già
// introdotto per il tiro libero di P0.3. Nessuna formula, risultato o modificatore proposto dal
// client viene mai accettato: il client invia solo `{ sheetId, target }` e, per un tiro di
// danno, se applicare il critico.
//
// Modello dei tiri (coerente con Roll20, non con vantaggio/svantaggio scelto prima del tiro):
// ogni bersaglio 1d20 (caratteristica, tiro salvezza, abilità, iniziativa, strumento, salvataggio
// contro morte, tiro di attacco) tira sempre DUE d20 indipendenti e mostra entrambi i totali; è il
// giocatore a decidere quale contare (il primo per un tiro normale, il più alto per vantaggio, il
// più basso per svantaggio). Il dado vita non raddoppia: non è un d20 e non ha vantaggio/svantaggio.
// Il danno di un attacco è un bersaglio separato (`attack-damage:<id>`), tirato a richiesta dalla
// scheda o dal log; il client dichiara se applicare il critico (dadi raddoppiati, modificatore
// invariato), dedotto lato client dall'ultimo tiro di attacco visto per quel bersaglio.
import { randomUUID } from 'node:crypto';
import { resolveDiceRoll } from '../shared/dice-engine.mjs';
import {
  abilityModifier, computeAttackBonus, computeDamageModifier, computeInitiative,
  computeSavingThrowValue, computeSkillValue, computeToolBonus, parseWholeNumber, SKILL_ABILITY,
} from '../shared/dnd-rules.mjs';
import { CharacterSheetError } from './character-sheet-service.mjs';
import { nextCryptoUint32 } from './dice-entropy.mjs';

const ABILITY_LABELS = {
  strength: 'Forza', dexterity: 'Destrezza', constitution: 'Costituzione',
  intelligence: 'Intelligenza', wisdom: 'Saggezza', charisma: 'Carisma',
};
const SKILL_LABELS = {
  acrobatics: 'Acrobazia', animalHandling: 'Addestrare animali', arcana: 'Arcano', athletics: 'Atletica',
  deception: 'Inganno', history: 'Storia', insight: 'Intuizione', intimidation: 'Intimidire',
  investigation: 'Indagare', medicine: 'Medicina', nature: 'Natura', perception: 'Percezione',
  performance: 'Intrattenere', persuasion: 'Persuasione', religion: 'Religione',
  sleightOfHand: 'Rapidità di mano', stealth: 'Furtività', survival: 'Sopravvivenza',
};

const UNINTERPRETABLE_ERROR = 'Il valore di questo bersaglio non è interpretabile come numero. Correggi il campo prima di tirare.';

function makePlan(overrides) {
  return { actionLabel: '', group: null, groups: null, dual: true, savingThrow: null, critRange: null, sideEffect: null, ...overrides };
}

function parseDiceText(value) {
  const match = typeof value === 'string' ? value.trim().match(/^(\d{1,2})d(4|6|8|10|12|20|100)$/i) : null;
  return match ? { count: Number(match[1]), sides: Number(match[2]) } : null;
}

function resolveAbility(data, key) {
  if (!ABILITY_LABELS[key]) return null;
  const modifier = abilityModifier(data.character.abilities[key].score);
  if (modifier === null) return { error: UNINTERPRETABLE_ERROR };
  return makePlan({ actionLabel: `Prova di ${ABILITY_LABELS[key]}`, group: { count: 1, sides: 20, modifier } });
}

function resolveSavingThrow(data, key) {
  if (!ABILITY_LABELS[key]) return null;
  const row = data.character.savingThrows[key];
  const value = computeSavingThrowValue({
    score: data.character.abilities[key].score, proficient: row.proficient,
    level: data.character.level, miscBonus: row.miscBonus,
  });
  if (value === null) return { error: UNINTERPRETABLE_ERROR };
  return makePlan({ actionLabel: `Tiro salvezza su ${ABILITY_LABELS[key]}`, group: { count: 1, sides: 20, modifier: value } });
}

function resolveSkill(data, key) {
  const label = SKILL_LABELS[key];
  if (!label) return null;
  const row = data.character.skills[key];
  const abilityKey = SKILL_ABILITY[key];
  const value = computeSkillValue({
    score: data.character.abilities[abilityKey].score, proficiency: row.proficiency,
    level: data.character.level, miscBonus: row.miscBonus,
  });
  if (value === null) return { error: UNINTERPRETABLE_ERROR };
  return makePlan({ actionLabel: `Prova di ${label}`, group: { count: 1, sides: 20, modifier: value } });
}

function resolveInitiative(data) {
  const value = computeInitiative({
    dexScore: data.character.abilities.dexterity.score, miscBonus: data.character.initiativeMiscBonus,
  });
  if (value === null) return { error: UNINTERPRETABLE_ERROR };
  return makePlan({ actionLabel: 'Iniziativa', group: { count: 1, sides: 20, modifier: value } });
}

function resolveTool(data, id) {
  const row = data.character.tools.find((tool) => tool.id === id);
  if (!row) return { error: 'Strumento non trovato.' };
  const label = row.name || 'Strumento';
  if (!row.ability) return { error: UNINTERPRETABLE_ERROR };
  const value = computeToolBonus({
    score: data.character.abilities[row.ability].score, proficiency: row.proficiency,
    level: data.character.level, miscBonus: row.bonus,
  });
  if (value === null) return { error: UNINTERPRETABLE_ERROR };
  return makePlan({ actionLabel: label, group: { count: 1, sides: 20, modifier: value } });
}

function resolveHitDice(data) {
  const type = data.character.hitDice.type;
  if (!type) return { error: 'Scegli il tipo di dado vita prima di tirare.' };
  const remaining = parseWholeNumber(data.character.hitDice.remaining);
  if (remaining === null || remaining <= 0) return { error: 'Nessun dado vita rimasto.' };
  const sides = Number(type.slice(1));
  return makePlan({
    actionLabel: 'Dado vita', dual: false, group: { count: 1, sides, modifier: 0 },
    sideEffect: { kind: 'hit-dice', remaining },
  });
}

function resolveDeathSaves(data) {
  const successes = parseWholeNumber(data.character.deathSaves.successes) ?? 0;
  const failures = parseWholeNumber(data.character.deathSaves.failures) ?? 0;
  if (successes >= 3 || failures >= 3) {
    return { error: 'I salvataggi contro morte sono già decisi. Azzera i pallini per continuare.' };
  }
  // I salvataggi contro morte non hanno nozione di vantaggio/svantaggio in 5e: un solo `1d20`,
  // come il dado vita, non i due tiri indipendenti dei bersagli 1d20 ordinari.
  return makePlan({
    actionLabel: 'Tiro salvezza contro morte', dual: false, group: { count: 1, sides: 20, modifier: 0 },
    sideEffect: { kind: 'death-save', successes, failures },
  });
}

// Un blocco di danno senza caratteristica scelta contribuisce con modificatore zero: è uno stato
// di configurazione valido (`computeDamageModifier` lo tratta come "nessun modificatore da
// mostrare", non come un valore da rifiutare). Il bonus aggiuntivo del blocco resta un dato
// dichiarato solo quando una caratteristica è scelta, coerentemente con la funzione condivisa.
function resolveDamageBlock(data, row, enabledKey, diceKey, abilityKey, bonusKey, label) {
  if (!row[enabledKey]) return null;
  const parsedDice = parseDiceText(row[diceKey]);
  if (!parsedDice) return { error: 'Il dado di danno non è nel formato NdS, ad esempio 1d8.' };
  const ability = row[abilityKey];
  let modifier = 0;
  if (ability) {
    modifier = computeDamageModifier({ score: data.character.abilities[ability].score, bonus: row[bonusKey] });
    if (modifier === null) return { error: UNINTERPRETABLE_ERROR };
  }
  return { group: { label, count: parsedDice.count, sides: parsedDice.sides, modifier } };
}

// Il tiro di attacco è ora un bersaglio a sé: produce solo il tiro per colpire (due d20). Il
// danno si tira separatamente da `attack-damage:<id>`, dalla scheda o dal log.
function resolveAttack(data, id) {
  const row = data.character.attacks.find((attack) => attack.id === id);
  if (!row) return { error: 'Attacco non trovato.' };
  const label = row.name || 'Attacco';
  if (!row.attackEnabled) return { error: 'Questo attacco non ha un tiro di attacco attivo.' };

  const attackBonus = computeAttackBonus({
    score: row.attackAbility ? data.character.abilities[row.attackAbility].score : '',
    proficient: row.attackProficient, level: data.character.level, magicBonus: row.magicBonus, bonus: row.attackBonus,
  });
  if (attackBonus === null) return { error: UNINTERPRETABLE_ERROR };

  const critRange = parseWholeNumber(row.critRange) ?? 20;
  const savingThrow = row.saveEnabled ? { ability: row.saveAbility || null, dc: row.saveDc } : null;
  return makePlan({
    actionLabel: `Attacco — ${label}`, group: { count: 1, sides: 20, modifier: attackBonus },
    critRange, savingThrow, isAttackRoll: true,
  });
}

// Il danno di un attacco: uno o due blocchi indipendenti (il primo è sempre attivo dalla Fase A).
// Nessun tiro di attacco qui: il critico arriva dichiarato dal client (vedi intestazione del file).
function resolveAttackDamage(data, id) {
  const row = data.character.attacks.find((attack) => attack.id === id);
  if (!row) return { error: 'Attacco non trovato.' };
  const label = row.name || 'Attacco';

  const groups = [];
  const damageBlocks = [
    ['damageEnabled', 'damageDice', 'damageAbility', 'damageBonus', 'Danno'],
    ['damage2Enabled', 'damage2Dice', 'damage2Ability', 'damage2Bonus', 'Danno secondario'],
  ];
  for (const [enabledKey, diceKey, abilityKey, bonusKey, damageLabel] of damageBlocks) {
    const resolved = resolveDamageBlock(data, row, enabledKey, diceKey, abilityKey, bonusKey, damageLabel);
    if (resolved?.error) return resolved;
    if (resolved) groups.push(resolved.group);
  }
  if (!groups.length) return { error: 'Questo attacco non ha alcun blocco di danno attivo.' };

  return makePlan({ actionLabel: `Danno — ${label}`, dual: false, groups, isDamageRoll: true });
}

function resolveTargetPlan(data, target) {
  const [kind, ...rest] = target.split(':');
  const id = rest.join(':');
  if (kind === 'ability') return resolveAbility(data, id);
  if (kind === 'saving-throw') return resolveSavingThrow(data, id);
  if (kind === 'skill') return resolveSkill(data, id);
  if (kind === 'initiative') return resolveInitiative(data);
  if (kind === 'tool') return resolveTool(data, id);
  if (kind === 'hit-dice') return resolveHitDice(data);
  if (kind === 'death-saves') return resolveDeathSaves(data);
  if (kind === 'attack') return resolveAttack(data, id);
  if (kind === 'attack-damage') return resolveAttackDamage(data, id);
  return null;
}

// Punto d'ingresso usato da `POST /api/battle-map/rolls` quando il payload porta `source` invece
// di `formula`. Restituisce `{ error }` oppure `{ log }`. Un tiro 1d20 (bersaglio "dual") tira
// sempre due dadi indipendenti; un tiro di danno raddoppia i dadi di ogni blocco quando il client
// dichiara `critical: true`. Qualunque effetto collaterale (dadi vita, salvataggi contro morte)
// passa da `service.applyPatch` prima che il log sia costruito: un rifiuto della patch interrompe
// la richiesta senza aggiungere alcuna voce.
export function rollCharacterSheetTarget(user, service, requestBody, options = {}) {
  const nextUint32 = options.nextUint32 ?? options.rng ?? nextCryptoUint32;
  const source = requestBody?.source;
  const sheetId = source?.sheetId;
  const target = source?.target;
  if (typeof sheetId !== 'string' || !sheetId || typeof target !== 'string' || !target) {
    return { error: 'Bersaglio di tiro non valido.' };
  }
  const visibility = requestBody?.visibility === 'secret' ? 'secret' : 'public';

  let sheet;
  try {
    sheet = service.get(user, sheetId);
  } catch (error) {
    return { error: error instanceof CharacterSheetError ? error.message : 'Impossibile leggere la scheda.' };
  }

  const plan = resolveTargetPlan(sheet.data, target);
  if (!plan) return { error: 'Bersaglio di tiro sconosciuto.' };
  if (plan.error) return plan;

  const characterName = sheet.data.character.name || 'Personaggio senza nome';
  const rollerName = user.displayName ?? user.username;
  const timestamp = new Date().toISOString();
  const baseLog = {
    id: randomUUID(), label: plan.actionLabel, rollerName, authorUserId: user.id, timestamp,
    mode: 'normal', visibility, characterName, actionLabel: plan.actionLabel, source: { sheetId, target },
  };

  if (plan.isDamageRoll) {
    const critical = requestBody?.critical === true;
    const resolved = resolveDiceRoll({
      groups: plan.groups.map((group) => ({
        ...group,
        count: critical ? group.count * 2 : group.count,
      })),
    }, { nextUint32 });
    const rolledParts = resolved.groups.map((group) => ({
      label: group.label,
      formula: group.formula,
      rolls: group.rolls,
      keptRolls: group.keptRolls,
      modifier: group.modifier,
      total: group.total,
      critical,
    }));
    const log = {
      ...baseLog,
      formula: rolledParts[0].formula, rolls: rolledParts[0].rolls, keptRolls: rolledParts[0].rolls,
      total: rolledParts[0].total, modifier: rolledParts[0].modifier, critical, dice: resolved.dice,
    };
    if (rolledParts.length > 1) log.parts = rolledParts;
    return { log };
  }

  // Bersaglio 1d20 (o dado vita): una risoluzione `unresolved` genera la coppia senza scegliere
  // per il giocatore; i campi legacy continuano a rappresentare il primo risultato.
  const resolved = resolveDiceRoll({
    groups: [plan.group],
    mode: plan.dual ? 'unresolved' : 'normal',
  }, { nextUint32 });

  let critical;
  if (plan.isAttackRoll) {
    critical = resolved.rolls.some((roll) => roll >= plan.critRange);
  }

  let sideEffectOperations = null;
  if (plan.sideEffect?.kind === 'hit-dice') {
    sideEffectOperations = [{ op: 'set', path: 'character.hitDice.remaining', value: String(plan.sideEffect.remaining - 1) }];
  } else if (plan.sideEffect?.kind === 'death-save') {
    // Il primo dei due tiri (il "tiro normale") decide l'esito: il server non può sapere quale
    // dei due il giocatore intende tenere, e l'effetto collaterale deve restare singolo e certo.
    const succeeded = resolved.total >= 10;
    sideEffectOperations = [{
      op: 'set',
      path: succeeded ? 'character.deathSaves.successes' : 'character.deathSaves.failures',
      value: String((succeeded ? plan.sideEffect.successes : plan.sideEffect.failures) + 1),
    }];
  }
  if (sideEffectOperations) {
    try {
      service.applyPatch(user, sheetId, { baseVersion: sheet.version, operations: sideEffectOperations });
    } catch (error) {
      return { error: error instanceof CharacterSheetError ? error.message : 'Effetto collaterale del tiro non applicato.' };
    }
  }

  const log = {
    ...baseLog,
    formula: resolved.formula, rolls: resolved.rolls,
    keptRolls: resolved.keptRolls, total: resolved.total, modifier: resolved.modifier,
    dice: resolved.dice,
  };
  if (critical !== undefined) log.critical = critical;
  if (plan.savingThrow) log.savingThrow = plan.savingThrow;
  return { log };
}

export const __testables = { resolveTargetPlan };
