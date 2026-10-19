import { useEffect, useState, type FormEvent } from 'react';
import type { EncounterTokenProperties, SceneEncounterEntityReference } from '../types';
import type { EncounterEntityInput, PersistedScene } from '../utils/sceneApi';

type EntityDraft = {
  name: string;
  kind: EncounterEntityInput['kind'];
  size: string;
  widthCells: string;
  heightCells: string;
  color: string;
  initiativeModifier: string;
  movementCells: string;
  hitPoints: string;
  maxHitPoints: string;
  isInvisible: boolean;
  excludeFromInitiative: boolean;
};

const EMPTY_DRAFT: EntityDraft = {
  name: '', kind: 'monster', size: '', widthCells: '', heightCells: '', color: '',
  initiativeModifier: '', movementCells: '', hitPoints: '', maxHitPoints: '',
  isInvisible: false, excludeFromInitiative: false,
};

function draftFromEntity(entity: SceneEncounterEntityReference): EntityDraft {
  const data = entity.tokenProperties ?? {};
  return {
    name: entity.name,
    kind: entity.entityType,
    size: data.size ?? '',
    widthCells: String(data.widthCells ?? ''),
    heightCells: String(data.heightCells ?? ''),
    color: data.color ?? '',
    initiativeModifier: String(data.initiativeModifier ?? ''),
    movementCells: String(data.movementCells ?? ''),
    hitPoints: String(data.hitPoints ?? ''),
    maxHitPoints: String(data.maxHitPoints ?? ''),
    isInvisible: data.isInvisible ?? false,
    excludeFromInitiative: data.excludeFromInitiative ?? false,
  };
}

function payloadFromDraft(draft: EntityDraft): EncounterEntityInput {
  const tokenProperties: EncounterTokenProperties = {};
  if (draft.size) tokenProperties.size = draft.size as EncounterTokenProperties['size'];
  for (const key of ['widthCells', 'heightCells', 'initiativeModifier', 'movementCells', 'hitPoints', 'maxHitPoints'] as const) {
    if (draft[key] !== '') tokenProperties[key] = Number(draft[key]);
  }
  if (draft.color) tokenProperties.color = draft.color.trim();
  if (draft.isInvisible) tokenProperties.isInvisible = true;
  if (draft.excludeFromInitiative) tokenProperties.excludeFromInitiative = true;
  return { name: draft.name.trim(), kind: draft.kind, tokenProperties };
}

interface Props {
  scene: PersistedScene;
  encounterId: string;
  disabled: boolean;
  onCreate: (encounterId: string, entity: EncounterEntityInput) => Promise<boolean>;
  onUpdate: (encounterId: string, referenceId: string, entity: EncounterEntityInput) => Promise<boolean>;
}

export function SceneEncounterEntitySection({ scene, encounterId, disabled, onCreate, onUpdate }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EntityDraft>(EMPTY_DRAFT);
  const [notice, setNotice] = useState<string | null>(null);
  const entities = scene.document.entityReferences.filter((reference): reference is SceneEncounterEntityReference =>
    reference.encounterId === encounterId && (reference.entityType === 'monster' || reference.entityType === 'npc'));
  const selected = entities.find((entity) => entity.id === selectedId) ?? null;

  useEffect(() => {
    setSelectedId(null);
    setDraft(EMPTY_DRAFT);
    setNotice(null);
  }, [scene.id, encounterId]);

  useEffect(() => {
    if (!selectedId) return;
    const current = entities.find((entity) => entity.id === selectedId);
    if (current) setDraft(draftFromEntity(current));
    else { setSelectedId(null); setDraft(EMPTY_DRAFT); }
  }, [scene.version, selectedId]);

  const choose = (entity: SceneEncounterEntityReference | null) => {
    setSelectedId(entity?.id ?? null);
    setDraft(entity ? draftFromEntity(entity) : EMPTY_DRAFT);
    setNotice(null);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setNotice(null);
    if (!draft.name.trim()) return;
    const payload = payloadFromDraft(draft);
    const saved = selected
      ? await onUpdate(encounterId, selected.id, payload)
      : await onCreate(encounterId, payload);
    if (saved) {
      if (!selected) choose(null);
      setNotice(selected ? 'Figura aggiornata.' : 'Figura aggiunta all’encounter.');
    }
  };

  const textField = (key: 'widthCells' | 'heightCells' | 'color' | 'initiativeModifier' |
    'movementCells' | 'hitPoints' | 'maxHitPoints', label: string, options: {
    min?: number; max?: number; step?: number | 'any'; placeholder?: string; pattern?: string;
  } = {}) => <label key={key}>{label}
    <input type={key === 'color' ? 'text' : 'number'} value={draft[key]} disabled={disabled}
      {...options} onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))} />
  </label>;

  return <section className="scene-entity-editor" aria-labelledby="scene-entity-heading">
    <div className="scene-entity-editor__heading">
      <div>
        <p className="scene-catalog__eyebrow">Figure dell’incontro</p>
        <h5 id="scene-entity-heading">Mostri e PNG</h5>
        <p>Prepara le figure qui. Compariranno sulla mappa solo dopo un’azione di collocazione.</p>
      </div>
      <button type="button" className="secondary-button" disabled={disabled} onClick={() => choose(null)}>Nuova figura</button>
    </div>
    <div className="scene-entity-editor__layout">
      <nav aria-label="Figure dell’encounter">
        {entities.length ? <ul className="scene-encounters__list">
          {entities.map((entity) => <li key={entity.id}><button type="button"
            aria-current={selectedId === entity.id ? 'true' : undefined} onClick={() => choose(entity)}>
            <strong>{entity.name}</strong><span>{entity.entityType === 'monster' ? 'Mostro' : 'PNG'}</span>
          </button></li>)}
        </ul> : <p className="scene-catalog__hint">Nessuna figura preparata. Aggiungi un mostro o un PNG all’incontro.</p>}
      </nav>
      <form className="scene-encounters__form" onSubmit={(event) => void submit(event)}>
        <strong>{selected ? `Modifica ${selected.name}` : 'Nuova figura'}</strong>
        <div className="scene-entity-editor__fields">
          <label>Nome
            <input required maxLength={120} value={draft.name} disabled={disabled}
              onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
          </label>
          <label>Tipo
            <select value={draft.kind} disabled={disabled}
              onChange={(event) => setDraft((current) => ({ ...current, kind: event.target.value as EntityDraft['kind'] }))}>
              <option value="monster">Mostro</option><option value="npc">PNG</option>
            </select>
          </label>
          <label>Taglia
            <select value={draft.size} disabled={disabled}
              onChange={(event) => setDraft((current) => ({ ...current, size: event.target.value }))}>
              <option value="">Media (predefinita)</option>
              <option value="tiny">Minuscola</option><option value="small">Piccola</option>
              <option value="medium">Media</option><option value="large">Grande</option>
              <option value="huge">Enorme</option><option value="gargantuan">Mastodontica</option>
            </select>
          </label>
          {textField('hitPoints', 'Punti ferita', { min: 0, max: 100000, step: 'any' })}
          {textField('maxHitPoints', 'Punti ferita massimi', { min: 0, max: 100000, step: 'any' })}
          {textField('initiativeModifier', 'Modificatore iniziativa', { min: -100, max: 100, step: 1 })}
        </div>
        <details className="scene-entity-editor__advanced">
          <summary>Altre proprietà del token</summary>
          <div className="scene-entity-editor__fields">
            {textField('widthCells', 'Larghezza in caselle', { min: 1, max: 40, step: 1 })}
            {textField('heightCells', 'Altezza in caselle', { min: 1, max: 40, step: 1 })}
            {textField('movementCells', 'Movimento in caselle', { min: 0, max: 1000, step: 'any' })}
            {textField('color', 'Colore esadecimale', { placeholder: '#9b1f1b', pattern: '#[0-9a-fA-F]{6}' })}
          </div>
          <div className="scene-entity-editor__checks">
            <label><input type="checkbox" checked={draft.isInvisible} disabled={disabled}
              onChange={(event) => setDraft((current) => ({ ...current, isInvisible: event.target.checked }))} /> Invisibile</label>
            <label><input type="checkbox" checked={draft.excludeFromInitiative} disabled={disabled}
              onChange={(event) => setDraft((current) => ({ ...current, excludeFromInitiative: event.target.checked }))} /> Escludi dall’iniziativa</label>
          </div>
        </details>
        <div className="scene-encounters__actions">
          <button type="submit" className="primary-button" disabled={disabled || !draft.name.trim()}>
            {selected ? 'Salva figura' : 'Aggiungi figura'}
          </button>
        </div>
        {notice ? <p className="scene-catalog__status" role="status">{notice}</p> : null}
      </form>
    </div>
  </section>;
}
