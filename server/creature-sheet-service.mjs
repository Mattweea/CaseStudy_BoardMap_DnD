import { applyHitPointDelta, hitPointTransition } from '../shared/hit-points.mjs';
import { applyConditionChange } from '../shared/token-conditions.mjs';
import { randomUUID, createHash } from 'node:crypto';
import {
  emptyMonster,
  validateMonster,
  splitCreatureData,
  composeCreatureData,
  applySheetOperation,
} from '../shared/creature-sheet-data.mjs';
import {
  createInitialCharacterSheetData,
  assertValidCharacterSheetData,
  validatePatchOperation,
} from './character-sheet-schema.mjs';
import { computeInitiative } from '../shared/dnd-rules.mjs';
import { projectSheetAuras } from '../shared/token-auras.mjs';
import { rollCharacterSheetTarget } from './character-sheet-roll-resolver.mjs';
import { createAuthoritativeRoll } from './authoritative-roll.mjs';
export class CreatureSheetError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
const requireMaster = (user) => {
  if (!user) throw new CreatureSheetError('Autenticazione richiesta.', 401);
  if (user.role !== 'master') throw new CreatureSheetError('Operazione riservata al Master.', 403);
};
const num = (value) => (/^\d+$/.test(String(value).trim()) ? Number(value) : null);
export class CreatureSheetService {
  constructor({ db, sceneService, getTokens, emit = () => {}, project = () => {} }) {
    Object.assign(this, { db, sceneService, getTokens, emit, project });
  }
  source(sceneId, tokenId) {
    const scene = this.sceneService.getScene(sceneId);
    if (!scene) throw new CreatureSheetError('Scena non trovata.', 404);
    const placement = scene.document.preparedPlacements.find((p) => p.id === tokenId);
    const entity = scene.document.entityReferences.find((e) => e.id === placement?.entityReferenceId);
    const token = this.getTokens(sceneId).find((t) => t.id === tokenId);
    if (!placement && !token) throw new CreatureSheetError('Creatura non disponibile nella scena.', 404);
    if (entity && !['monster', 'npc'].includes(entity.entityType))
      throw new CreatureSheetError('La figura non è una creatura.');
    if (token?.ownerUserId || (!entity && !['enemy', 'player'].includes(token?.type)))
      throw new CreatureSheetError('Usa la scheda personale del PG o una creatura valida.');
    return {
      scene,
      placement,
      entity,
      token,
      kind: entity?.entityType === 'npc' || token?.type === 'player' ? 'character' : 'monster',
      name: token?.name ?? placement?.name ?? entity?.name ?? 'Creatura',
    };
  }
  validate(kind, data) {
    if (kind === 'monster') {
      const error = validateMonster(data);
      if (error) throw new TypeError(error);
    } else assertValidCharacterSheetData(data);
  }
  definition(id) {
    const row = this.db.prepare('SELECT * FROM creature_sheet_definitions WHERE id=?').get(id);
    if (!row || row.campaign_id !== this.sceneService.campaignId)
      throw new CreatureSheetError('Scheda non trovata.', 404);
    return row;
  }
  binding(id) {
    const row = this.db.prepare('SELECT * FROM creature_sheet_bindings WHERE id=?').get(id);
    if (!row) throw new CreatureSheetError('Collegamento scheda non trovato.', 404);
    return row;
  }
  targets(sheetId) {
    return this.db
      .prepare(
        `SELECT b.*,s.name AS scene_name,s.version AS scene_version FROM creature_sheet_bindings b JOIN scenes s ON s.id=b.scene_id WHERE b.sheet_id=? ORDER BY b.scene_id,b.id`,
      )
      .all(sheetId)
      .map((b) => {
        let name = b.token_name;
        try {
          name = this.source(b.scene_id, b.token_id).name;
        } catch {}
        return {
          id: b.id,
          tokenId: b.token_id,
          name,
          sceneId: b.scene_id,
          sceneName: b.scene_name,
          sceneVersion: b.scene_version,
          version: b.version,
        };
      });
  }
  signature(definition) {
    return createHash('sha256')
      .update(JSON.stringify({ id: definition.id, version: definition.version, targets: this.targets(definition.id) }))
      .digest('hex');
  }
  record(id) {
    const b = this.binding(id),
      d = this.definition(b.sheet_id);
    return {
      id: b.id,
      sheetId: d.id,
      kind: d.kind,
      sceneId: b.scene_id,
      tokenId: b.token_id,
      name: b.token_name,
      version: d.version,
      bindingVersion: b.version,
      data: composeCreatureData(JSON.parse(d.data_json), JSON.parse(b.instance_json)),
      targets: this.targets(d.id),
      signature: this.signature(d),
      portraitUrl: d.portrait_file ? `/api/creature-sheets/${d.id}/portrait?v=${d.version}` : null,
    };
  }
  get(user, id) {
    requireMaster(user);
    return this.record(id);
  }
  context(user, sceneId, tokenId) {
    requireMaster(user);
    const source = this.source(sceneId, tokenId);
    const binding = this.db
      .prepare('SELECT id FROM creature_sheet_bindings WHERE scene_id=? AND token_id=?')
      .get(sceneId, tokenId);
    const related = source.entity
      ? source.scene.document.preparedPlacements
          .filter((p) => p.entityReferenceId === source.entity.id)
          .map((p) => ({ tokenId: p.id, name: p.name ?? source.entity.name }))
      : [];
    const sheets = this.db
      .prepare('SELECT id,kind,data_json FROM creature_sheet_definitions WHERE campaign_id=? AND kind=?')
      .all(source.scene.campaignId, source.kind)
      .map((d) => ({
        id: d.id,
        name: (JSON.parse(d.data_json).character?.name ?? JSON.parse(d.data_json).name) || 'Senza nome',
      }));
    return { record: binding ? this.record(binding.id) : null, kind: source.kind, related, sheets };
  }
  bind(user, { sceneId, tokenId, sheetId, includeRelated = false }) {
    requireMaster(user);
    if (typeof includeRelated !== 'boolean' || (sheetId !== undefined && (typeof sheetId !== 'string' || !sheetId)))
      throw new TypeError('Collegamento non valido.');
    const source = this.source(sceneId, tokenId);
    return this.db.transaction(() => {
      let definition;
      if (sheetId) {
        definition = this.definition(sheetId);
        if (definition.campaign_id !== source.scene.campaignId || definition.kind !== source.kind)
          throw new TypeError('Scheda di tipo o campagna incompatibile.');
      } else {
        const initial =
          source.kind === 'monster'
            ? emptyMonster(source.entity?.name ?? source.name)
            : createInitialCharacterSheetData({ displayName: source.entity?.name ?? source.name });
        const properties = source.entity?.tokenProperties ?? {};
        const maximum = String(source.token?.maxHitPoints ?? properties.maxHitPoints ?? '');
        const movement = source.token?.movementCells ?? properties.movementCells;
        if (source.kind === 'monster') {
          initial.hitPointsMaximum = maximum;
          initial.size = source.token?.size ?? properties.size ?? '';
          if (typeof movement === 'number') initial.speed = String(movement * 5);
        } else {
          initial.character.hitPoints.maximum = maximum;
          if (typeof movement === 'number') initial.character.speed = `${movement * 5} ft`;
        }
        const common = splitCreatureData(initial).common;
        sheetId = randomUUID();
        this.db
          .prepare('INSERT INTO creature_sheet_definitions(id,campaign_id,kind,data_json) VALUES(?,?,?,?)')
          .run(sheetId, source.scene.campaignId, source.kind, JSON.stringify(common));
        definition = this.definition(sheetId);
      }
      const tokens =
        includeRelated && source.entity
          ? source.scene.document.preparedPlacements
              .filter((p) => p.entityReferenceId === source.entity.id)
              .map((p) => p.id)
          : [tokenId];
      let opened;
      for (const id of tokens) {
        if (this.db.prepare('SELECT 1 FROM creature_sheet_bindings WHERE scene_id=? AND token_id=?').get(sceneId, id))
          throw new CreatureSheetError('Una creatura è già collegata: aggiorna la scelta.', 409);
        const target = this.source(sceneId, id),
          data = JSON.parse(definition.data_json);
        if (source.kind === 'monster') {
          data.hitPointsCurrent = String(
            target.token?.hitPoints ??
              target.entity?.tokenProperties?.hitPoints ??
              target.token?.maxHitPoints ??
              target.entity?.tokenProperties?.maxHitPoints ??
              (source.kind === 'monster' ? data.hitPointsMaximum : data.character.hitPoints.maximum) ??
              '',
          );
          data.hitPointsTemporary = String(target.token?.temporaryHitPoints ?? '');
        } else {
          data.character.hitPoints.current = String(
            target.token?.hitPoints ??
              target.entity?.tokenProperties?.hitPoints ??
              target.token?.maxHitPoints ??
              target.entity?.tokenProperties?.maxHitPoints ??
              (source.kind === 'monster' ? data.hitPointsMaximum : data.character.hitPoints.maximum) ??
              '',
          );
          data.character.hitPoints.temporary = String(target.token?.temporaryHitPoints ?? '');
        }
        const bindingId = `creature:${randomUUID()}`;
        this.db
          .prepare(
            'INSERT INTO creature_sheet_bindings(id,scene_id,token_id,token_name,sheet_id,instance_json) VALUES(?,?,?,?,?,?)',
          )
          .run(bindingId, sceneId, id, target.name, sheetId, JSON.stringify(splitCreatureData(data).instance));
        if (id === tokenId) opened = bindingId;
      }
      return this.record(opened);
    })();
  }
  previewHitPoints(user, id, payload) {
    this.preview(user, id, payload);
    if (!Number.isInteger(payload.delta) || payload.delta === 0 || Math.abs(payload.delta) > 999)
      throw new TypeError('Danno o cura: intero da 1 a 999.');
    const record = this.get(user, id),
      data = structuredClone(payload.data);
    const values =
      record.kind === 'monster'
        ? { current: data.hitPointsCurrent, temporary: data.hitPointsTemporary, maximum: data.hitPointsMaximum }
        : data.character.hitPoints;
    const result = applyHitPointDelta(values, payload.delta);
    if (result.error) throw new TypeError('Imposta PF attuali e massimi validi prima di applicare danno o cura.');
    if (record.kind === 'monster') {
      data.hitPointsCurrent = String(result.current);
      data.hitPointsTemporary = String(result.temporary ?? '');
    } else {
      data.character.hitPoints.current = String(result.current);
      data.character.hitPoints.temporary = String(result.temporary ?? '');
    }
    return { data };
  }

  preview(user, id, payload) {
    requireMaster(user);
    const record = this.record(id);
    this.validate(record.kind, payload.data);
    if (payload.baseVersion !== record.version || payload.bindingVersion !== record.bindingVersion)
      throw new CreatureSheetError('Scheda modificata: aggiorna prima di salvare.', 409);
    return {
      targets: record.targets,
      signature: record.signature,
      individualFields: splitCreatureData(payload.data).instance.map((v) => v.path.join('.')),
    };
  }
  save(user, id, payload) {
    requireMaster(user);
    const saved = this.db.transaction(() => {
      const preview = this.preview(user, id, payload),
        b = this.binding(id),
        d = this.definition(b.sheet_id);
      if (payload.signature !== preview.signature)
        throw new CreatureSheetError('I destinatari sono cambiati. Riapri la conferma.', 409);
      if (!['one', 'all'].includes(payload.scope)) throw new TypeError('Scegli i destinatari del salvataggio.');
      const before = this.record(id);
      const data = structuredClone(payload.data);
      if (
        d.kind === 'character' &&
        hitPointTransition(before.data.character.hitPoints.current, data.character.hitPoints.current) === 'up'
      ) {
        data.character.deathSaves.successes = '0';
        data.character.deathSaves.failures = '0';
      }
      const { common, instance } = splitCreatureData(data);
      if (payload.scope === 'one' && preview.targets.length > 1) {
        const newId = randomUUID();
        this.db
          .prepare(
            'INSERT INTO creature_sheet_definitions(id,campaign_id,kind,data_json,portrait_file,portrait_type) VALUES(?,?,?,?,?,?)',
          )
          .run(newId, d.campaign_id, d.kind, JSON.stringify(common), d.portrait_file, d.portrait_type);
        this.db.prepare('UPDATE creature_sheet_bindings SET sheet_id=? WHERE id=?').run(newId, id);
      } else
        this.db
          .prepare('UPDATE creature_sheet_definitions SET data_json=?,version=version+1 WHERE id=?')
          .run(JSON.stringify(common), d.id);
      this.db
        .prepare('UPDATE creature_sheet_bindings SET instance_json=?,version=version+1 WHERE id=?')
        .run(JSON.stringify(instance), id);
      if (payload.portrait) {
        const def = this.binding(id).sheet_id;
        this.db
          .prepare('UPDATE creature_sheet_definitions SET portrait_file=?,portrait_type=? WHERE id=?')
          .run(payload.portrait.fileName, payload.portrait.mediaType, def);
      }
      return this.record(id);
    })();
    this.changed(saved);
    return saved;
  }
  changed(record) {
    this.project();
    this.emit({ type: 'creature-sheet-saved', sheetId: record.sheetId, bindingId: record.id, version: record.version });
  }
  projectTokens(tokens, sceneId) {
    return tokens.map((token) => {
      const b = this.db
        .prepare('SELECT id FROM creature_sheet_bindings WHERE scene_id=? AND token_id=?')
        .get(sceneId, token.id);
      if (!b) return token;
      const record = this.record(b.id),
        d = record.data,
        monster = record.kind === 'monster';
      const hp = monster
        ? { maximum: d.hitPointsMaximum, current: d.hitPointsCurrent, temporary: d.hitPointsTemporary }
        : d.character.hitPoints;
      const dex = num(d.dexterity),
        initiative = monster
          ? dex === null
            ? token.initiativeModifier
            : Math.floor((dex - 10) / 2)
          : computeInitiative({
              dexScore: d.character.abilities.dexterity.score,
              miscBonus: d.character.initiativeMiscBonus,
            });
      const speedText = monster ? d.speed : d.character.speed;
      const feet = typeof speedText === 'string' ? speedText.match(/(\d+(?:[.,]\d+)?)\s*(?:ft|feet)/i) : null;
      const meters = typeof speedText === 'string' ? speedText.match(/(\d+(?:[.,]\d+)?)\s*m/i) : null;
      const movement = monster
        ? num(speedText) === null
          ? null
          : num(speedText) / 5
        : feet
          ? Number(feet[1].replace(',', '.')) / 5
          : meters
            ? Number(meters[1].replace(',', '.')) / 1.5
            : num(speedText) === null
              ? null
              : num(speedText) / 5;
      let conditions = token.conditions ?? [];
      const transition = hitPointTransition(token.hitPoints, num(hp.current));
      if (transition)
        conditions = applyConditionChange(
          { ...token, conditions },
          transition === 'down' ? 'add' : 'remove',
          'unconscious',
        ).conditions;
      return {
        ...token,
        conditions,
        creatureSheetId: record.id,
        hitPoints: num(hp.current),
        maxHitPoints: num(hp.maximum),
        temporaryHitPoints: num(hp.temporary),
        initiativeModifier: typeof initiative === 'number' ? initiative : token.initiativeModifier,
        initiativeMode: monster ? 'normal' : d.character.initiativeRollMode,
        ...(movement === null ? {} : { movementCells: Math.floor(movement) }),
        ...(record.portraitUrl ? { imageUrl: record.portraitUrl } : {}),
        auras: monster ? [] : projectSheetAuras(d.character.auras),
      };
    });
  }
  roll(user, id, request, options = {}) {
    requireMaster(user);
    const record = this.record(id);
    if (record.kind === 'monster') {
      const [collection, actionId, mode] = String(request.source?.target ?? '').split(':');
      const row = ['actions', 'bonusActions', 'reactions', 'legendaryActions'].includes(collection)
        ? record.data[collection].find((r) => r.id === actionId)
        : null;
      if (!row || !['attack', 'damage'].includes(mode)) return { error: 'Azione mostro non valida.' };
      const formula =
        mode === 'attack' ? `1d20${Number(row.attackBonus) >= 0 ? '+' : ''}${row.attackBonus}` : row.damageFormula;
      const result = createAuthoritativeRoll(
        user,
        { formula, visibility: request.visibility ?? 'public', name: row.name },
        options,
      );
      if (result.log) {
        result.log.characterName = record.name;
        result.log.actionLabel = row.name;
      }
      return result;
    }
    return rollCharacterSheetTarget(
      user,
      {
        get: () => ({ id, version: record.bindingVersion, data: record.data }),
        applyPatch: (_user, _id, payload) => {
          if (payload.baseVersion !== record.bindingVersion)
            throw new CreatureSheetError('Versione istanza obsoleta.', 409);
          const data = structuredClone(record.data);
          for (const op of payload.operations) {
            const error = validatePatchOperation(op);
            if (error) throw new TypeError(error);
            applySheetOperation(data, op);
          }
          this.validate('character', data);
          const split = splitCreatureData(data);
          this.db
            .prepare('UPDATE creature_sheet_bindings SET instance_json=?,version=version+1 WHERE id=? AND version=?')
            .run(JSON.stringify(split.instance), id, record.bindingVersion);
          this.changed(this.record(id));
          return this.record(id);
        },
      },
      request,
      options,
    );
  }
}
