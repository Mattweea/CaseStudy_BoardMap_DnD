// Tiro d'iniziativa autorevole (P0.8a). Unico punto che trasforma "tira l'iniziativa per questo
// token" in una voce del tracker e in una voce di log: lo usano sia l'endpoint del tracker sia il
// bersaglio `initiative` della scheda. Funzione pura rispetto allo stato condiviso: riceve lo
// stato corrente e restituisce `{ status, error }` oppure `{ entry, log }`; la commit (inserimento,
// log, versione, broadcast) resta al chiamante, in un'unica operazione.
//
// Il client indica soltanto il token e, dove ammesso, la modalità. Valori, totali e modificatori
// dichiarati dal client non vengono mai letti.
import { randomUUID } from 'node:crypto';
import { resolveDiceRoll } from '../shared/dice-engine.mjs';
import { abilityModifier, computeInitiative } from '../shared/dnd-rules.mjs';
import { CharacterSheetError } from './character-sheet-service.mjs';
import { nextCryptoUint32 } from './dice-entropy.mjs';

export const INITIATIVE_ROLL_MODES = Object.freeze(['normal', 'advantage', 'disadvantage']);
const ACTION_LABEL = 'Iniziativa';

function isCreature(token) {
  return token.type === 'player' || token.type === 'enemy';
}

// Il personaggio di un utente: token `player` non famiglio con un proprietario. È anche il token
// collegato alla scheda di quel proprietario.
export function isCharacterToken(token) {
  return Boolean(token) && token.type === 'player' && token.isFamiliar !== true && typeof token.ownerUserId === 'string';
}

export function findCharacterTokenForOwner(tokens, ownerUserId) {
  return tokens.find((token) => isCharacterToken(token) && token.ownerUserId === ownerUserId) ?? null;
}

function readLinkedSheet(user, token, service) {
  if (!isCharacterToken(token) || !service) return null;
  const sheetId = service.findIdByOwner(token.ownerUserId);
  if (!sheetId) return null;
  return service.get(user, sheetId);
}

export function rollInitiative({ user, state, service, tokenId, requestedMode, nextUint32 = nextCryptoUint32 }) {
  if (state.sessionMode !== 'combat') {
    return { status: 400, error: "La sessione è in Esplorazione: il tiro d'iniziativa si abilita quando il Master avvia il combattimento." };
  }
  const token = state.tokens.find((candidate) => candidate.id === tokenId);
  if (!token) return { status: 404, error: 'Token non trovato.' };
  if (!isCreature(token) || token.excludeFromInitiative === true) {
    return { status: 400, error: `${token.name} non partecipa all'iniziativa.` };
  }

  const isMaster = user.role === 'master';
  if (!isMaster) {
    if (!isCharacterToken(token) || token.ownerUserId !== user.id) {
      return { status: 403, error: "Puoi tirare l'iniziativa solo per il tuo personaggio." };
    }
    if (state.initiatives.some((entry) => entry.tokenId === tokenId)) {
      return { status: 400, error: "Hai già tirato l'iniziativa: per correggerla serve il Master." };
    }
  }

  let sheet;
  try {
    sheet = readLinkedSheet(user, token, service);
  } catch (error) {
    return { status: 400, error: error instanceof CharacterSheetError ? error.message : 'Impossibile leggere la scheda.' };
  }

  let modifier;
  let dexModifier;
  let mode;
  if (sheet) {
    const character = sheet.data.character;
    modifier = computeInitiative({ dexScore: character.abilities.dexterity.score, miscBonus: character.initiativeMiscBonus });
    if (modifier === null) {
      return { status: 400, error: "L'iniziativa della scheda non è interpretabile come numero. Correggi il campo prima di tirare." };
    }
    dexModifier = abilityModifier(character.abilities.dexterity.score) ?? 0;
    // La modalità è quella scelta nella scheda: nessuna modalità dichiarata dal client la sostituisce.
    mode = INITIATIVE_ROLL_MODES.includes(character.initiativeRollMode) ? character.initiativeRollMode : 'normal';
  } else {
    modifier = typeof token.initiativeModifier === 'number' ? token.initiativeModifier : 0;
    dexModifier = modifier;
    mode = isMaster && INITIATIVE_ROLL_MODES.includes(requestedMode) ? requestedMode : 'normal';
  }

  const resolved = resolveDiceRoll({ groups: [{ count: 1, sides: 20, modifier }], mode }, { nextUint32 });
  const entry = {
    tokenId,
    value: resolved.total,
    source: 'rolled',
    dexModifier,
    tiebreaker: nextUint32() / 0x1_0000_0000,
    mode,
  };
  const log = {
    id: randomUUID(),
    label: ACTION_LABEL,
    formula: resolved.formula,
    rollerName: user.displayName ?? user.username,
    authorUserId: user.id,
    timestamp: new Date().toISOString(),
    rolls: resolved.rolls,
    keptRolls: resolved.keptRolls,
    total: resolved.total,
    modifier: resolved.modifier,
    mode,
    // Pubblico per il personaggio di un Adventurer; segreto (autore Master) per ogni altra
    // creatura, così il log non rivela chi un Adventurer non può vedere.
    visibility: isCharacterToken(token) ? 'public' : 'secret',
    characterName: sheet?.data.character.name || token.name,
    actionLabel: ACTION_LABEL,
    dice: resolved.dice,
  };
  if (sheet) log.source = { sheetId: sheet.id, target: 'initiative' };
  return { entry, log };
}
