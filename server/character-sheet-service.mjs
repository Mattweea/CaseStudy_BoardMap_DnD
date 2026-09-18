import { CHARACTER_COLLECTION_KEYS, validateCharacterSheetData, validatePatchOperation } from './character-sheet-schema.mjs';
import { computeInitiative } from '../shared/dnd-rules.mjs';

export class CharacterSheetError extends Error {
  constructor(message, status = 400, details = {}) {
    super(message);
    this.name = 'CharacterSheetError';
    this.status = status;
    this.details = details;
  }
}

function getAtPath(document, path) {
  const parts = path.split('.');
  let current = document;
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    if (Array.isArray(current)) {
      current = current.find((item) => item.id === part);
    } else current = current?.[part];
  }
  return structuredClone(current);
}

function rowCollection(document, parts) {
  if (parts[0] === 'character') return document.character[parts[1]];
  return document.spells.levels[parts[2]].spells;
}

function applyOperation(document, operation) {
  const parts = operation.path.split('.');
  if (operation.op === 'add') {
    const collection = rowCollection(document, parts);
    if (collection.some((item) => item.id === operation.value.id)) throw new CharacterSheetError('Identificatore riga gia presente.', 400);
    collection.push(structuredClone(operation.value));
    return;
  }
  if (operation.op === 'remove') {
    const collectionParts = parts[0] === 'character' ? parts.slice(0, 2) : parts.slice(0, 4);
    const collection = rowCollection(document, collectionParts);
    const id = parts.at(-1);
    const index = collection.findIndex((item) => item.id === id);
    if (index < 0) throw new CharacterSheetError('Riga da rimuovere non trovata.', 400);
    collection.splice(index, 1);
    return;
  }
  let current = document;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const part = parts[index];
    if (Array.isArray(current)) {
      current = current.find((item) => item.id === part);
      if (!current) throw new CharacterSheetError('Riga da modificare non trovata.', 400);
    } else current = current[part];
  }
  current[parts.at(-1)] = operation.value;
}

function conflictPath(operation) {
  const parts = operation.path.split('.');
  if (operation.op === 'add') return `${operation.path}.${operation.value.id}`;
  if (parts[0] === 'character' && CHARACTER_COLLECTION_KEYS.includes(parts[1]) && parts.length >= 3) return parts.slice(0, 3).join('.');
  if (parts[0] === 'spells' && parts[1] === 'levels' && parts[3] === 'spells' && parts.length >= 5) return parts.slice(0, 5).join('.');
  return operation.path;
}

function publicSheet(state) {
  const sheet = state.record;
  return {
    id: sheet.id,
    ownerUserId: sheet.ownerUserId,
    campaignId: sheet.campaignId,
    version: state.version,
    data: structuredClone(state.data),
    portraitFileName: sheet.portraitFileName,
    portraitMediaType: sheet.portraitMediaType,
    portraitUpdatedAt: sheet.portraitUpdatedAt,
    portraitUrl: sheet.portraitFileName ? `/api/character-sheets/${sheet.id}/portrait?v=${encodeURIComponent(sheet.portraitUpdatedAt ?? '')}` : null,
    persistence: state.persistence,
  };
}

function numericValue(value) {
  if (value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export class CharacterSheetService {
  constructor({
    repository,
    policy,
    debounceMs = 1000,
    retryMs = 1000,
    schedule = (callback, delay) => setTimeout(callback, delay),
    cancel = (timer) => clearTimeout(timer),
    emit = () => {},
    projectToken = () => {},
  }) {
    this.repository = repository;
    this.policy = policy;
    this.debounceMs = debounceMs;
    this.retryMs = retryMs;
    this.schedule = schedule;
    this.cancel = cancel;
    this.emit = emit;
    this.projectToken = projectToken;
    this.live = new Map();
  }

  #load(id) {
    if (this.live.has(id)) return this.live.get(id);
    const record = this.repository.findById(id);
    if (!record) throw new CharacterSheetError('Scheda non trovata.', 404);
    const state = {
      record,
      data: structuredClone(record.data),
      version: record.version,
      persistedVersion: record.version,
      pathVersions: new Map(),
      dirty: false,
      timer: null,
      persistence: { status: 'saved', version: record.version, message: null },
    };
    this.live.set(id, state);
    return state;
  }

  get(user, id) {
    const state = this.#load(id);
    if (!this.policy.canRead(user, state.record)) throw new CharacterSheetError('Accesso alla scheda negato.', 403);
    return publicSheet(state);
  }

  getRoster(user, campaignId = 'local-campaign') {
    if (!user) throw new CharacterSheetError('Autenticazione richiesta.', 401);
    return this.repository.findByCampaign(campaignId).map((sheet) => ({
      id: sheet.id,
      ownerUserId: sheet.ownerUserId,
      portraitUrl: sheet.portraitFileName ? `/api/character-sheets/${sheet.id}/portrait?v=${encodeURIComponent(sheet.portraitUpdatedAt ?? '')}` : null,
      portraitUpdatedAt: sheet.portraitUpdatedAt,
    }));
  }

  applyPatch(user, id, payload) {
    const state = this.#load(id);
    if (!this.policy.canWrite(user, state.record)) throw new CharacterSheetError('Modifica della scheda negata.', 403);
    const baseVersion = payload?.baseVersion;
    const operations = payload?.operations;
    if (!Number.isInteger(baseVersion) || baseVersion < 1 || baseVersion > state.version || !Array.isArray(operations) || operations.length < 1 || operations.length > 100) {
      throw new CharacterSheetError('Payload patch non valido.', 400);
    }
    const validationErrors = operations.map(validatePatchOperation).filter(Boolean);
    if (validationErrors.length) throw new CharacterSheetError(validationErrors.join(' '), 400);

    const conflicts = operations.flatMap((operation) => {
      const key = conflictPath(operation);
      const modifiedAt = state.pathVersions.get(key) ?? 0;
      return modifiedAt > baseVersion ? [{ path: key, version: modifiedAt, value: getAtPath(state.data, key) }] : [];
    });
    if (conflicts.length) {
      throw new CharacterSheetError('La scheda contiene modifiche concorrenti sugli stessi campi.', 409, {
        version: state.version,
        conflicts,
      });
    }

    const nextData = structuredClone(state.data);
    operations.forEach((operation) => applyOperation(nextData, operation));
    const documentErrors = validateCharacterSheetData(nextData);
    if (documentErrors.length) throw new CharacterSheetError(documentErrors.join(' '), 400);

    state.data = nextData;
    state.version += 1;
    operations.forEach((operation) => state.pathVersions.set(conflictPath(operation), state.version));
    state.dirty = true;
    state.persistence = { status: 'saving', version: state.version, message: null };
    this.#scheduleFlush(state);

    const event = {
      type: 'character-sheet-patch',
      sheetId: id,
      ownerUserId: state.record.ownerUserId,
      version: state.version,
      operations: structuredClone(operations),
    };
    this.emit(event, state.record);
    this.#projectOperations(state.record.ownerUserId, operations, state.data);
    return { ...publicSheet(state), operations: event.operations };
  }

  // L'iniziativa non è più un campo della scheda: una patch sul punteggio di Destrezza o
  // sul suo bonus vari innesca il ricalcolo dal modulo condiviso, non una mappatura diretta.
  #projectOperations(ownerUserId, operations, data) {
    const updates = {};
    const mapping = {
      'character.name': ['name', (value) => value],
      'character.hitPoints.maximum': ['maxHitPoints', numericValue],
      'character.hitPoints.current': ['hitPoints', numericValue],
      'character.hitPoints.temporary': ['temporaryHitPoints', numericValue],
      'character.speed': ['speed', (value) => value],
    };
    const initiativePaths = new Set(['character.abilities.dexterity.score', 'character.initiativeMiscBonus']);
    let recalculateInitiative = false;
    operations.forEach((operation) => {
      if (operation.op !== 'set') return;
      if (initiativePaths.has(operation.path)) { recalculateInitiative = true; return; }
      if (!mapping[operation.path]) return;
      const [key, transform] = mapping[operation.path];
      updates[key] = transform(operation.value);
    });
    if (recalculateInitiative) {
      const initiativeModifier = computeInitiative({
        dexScore: data.character.abilities.dexterity.score,
        miscBonus: data.character.initiativeMiscBonus,
      });
      if (initiativeModifier !== null) updates.initiativeModifier = initiativeModifier;
    }
    if (Object.keys(updates).length) this.projectToken(ownerUserId, updates);
  }

  #scheduleFlush(state, delay = this.debounceMs) {
    if (state.timer !== null) this.cancel(state.timer);
    state.timer = this.schedule(() => {
      state.timer = null;
      try { this.flushById(state.record.id); } catch { /* status and retry are managed by flushById */ }
    }, delay);
  }

  flush(user, id) {
    const state = this.#load(id);
    if (!this.policy.canWrite(user, state.record)) throw new CharacterSheetError('Flush della scheda negato.', 403);
    return this.flushById(id);
  }

  flushById(id) {
    const state = this.#load(id);
    if (state.timer !== null) {
      this.cancel(state.timer);
      state.timer = null;
    }
    if (!state.dirty) return publicSheet(state);
    try {
      const saved = this.repository.saveVersion({
        id,
        expectedVersion: state.persistedVersion,
        version: state.version,
        data: state.data,
      });
      if (!saved) throw new Error('La versione SQLite e cambiata durante il salvataggio.');
      state.record = saved;
      state.persistedVersion = saved.version;
      state.dirty = false;
      state.persistence = { status: 'saved', version: saved.version, message: null };
      this.emit({ type: 'character-sheet-persistence', sheetId: id, ownerUserId: saved.ownerUserId, ...state.persistence }, saved);
      return publicSheet(state);
    } catch (error) {
      state.dirty = true;
      state.persistence = { status: 'error', version: state.version, message: error.message };
      this.emit({ type: 'character-sheet-persistence', sheetId: id, ownerUserId: state.record.ownerUserId, ...state.persistence }, state.record);
      this.#scheduleFlush(state, this.retryMs);
      throw new CharacterSheetError('Salvataggio della scheda non riuscito; verra riprovato.', 503, state.persistence);
    }
  }

  flushAll() {
    const failures = [];
    for (const id of this.live.keys()) {
      try { this.flushById(id); } catch (error) { failures.push({ id, error }); }
    }
    if (failures.length) throw new AggregateError(failures.map(({ error }) => error), 'Una o piu schede non sono state salvate.');
  }

  canSubscribe(user, sheetId) {
    const state = this.#load(sheetId);
    return this.policy.canSubscribe(user, state.record);
  }

  getPublicPortrait(sheetId) {
    const state = this.#load(sheetId);
    return {
      sheetId,
      ownerUserId: state.record.ownerUserId,
      portraitFileName: state.record.portraitFileName,
      portraitMediaType: state.record.portraitMediaType,
      portraitUpdatedAt: state.record.portraitUpdatedAt,
    };
  }

  getPortrait(user, sheetId) {
    const state = this.#load(sheetId);
    if (!this.policy.canViewPortrait(user, state.record)) throw new CharacterSheetError('Accesso al ritratto negato.', 403);
    return { fileName: state.record.portraitFileName, mediaType: state.record.portraitMediaType };
  }

  async replacePortrait(user, sheetId, file, storage) {
    const state = this.#load(sheetId);
    if (!this.policy.canWrite(user, state.record)) throw new CharacterSheetError('Modifica del ritratto negata.', 403);
    const previousFileName = state.record.portraitFileName;
    const staged = await storage.stage(file.buffer, file.mediaType);
    let updated;
    try {
      updated = this.repository.updatePortrait(sheetId, staged);
      if (!updated) throw new Error('Scheda non trovata durante il salvataggio del ritratto.');
    } catch (error) {
      await storage.remove(staged.fileName);
      throw error;
    }
    state.record = updated;
    if (previousFileName && previousFileName !== staged.fileName) await storage.remove(previousFileName);
    const event = {
      type: 'character-sheet-portrait',
      sheetId,
      ownerUserId: updated.ownerUserId,
      portraitUrl: `/api/character-sheets/${sheetId}/portrait?v=${encodeURIComponent(updated.portraitUpdatedAt ?? '')}`,
      portraitUpdatedAt: updated.portraitUpdatedAt,
    };
    this.emit(event, updated);
    return publicSheet(state);
  }
}
