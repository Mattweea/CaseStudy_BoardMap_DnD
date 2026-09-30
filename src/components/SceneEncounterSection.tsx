import { useEffect, useState, type FormEvent } from 'react';
import type { SceneEncounter } from '../types';
import type { EncounterEntityInput, PersistedScene } from '../utils/sceneApi';
import { SceneEncounterEntitySection } from './SceneEncounterEntitySection';

type EncounterDraft = Omit<SceneEncounter, 'id'>;
const EMPTY_DRAFT: EncounterDraft = { name: '', kind: 'narrative', description: '' };

interface SceneEncounterSectionProps {
  scene: PersistedScene;
  disabled: boolean;
  error: string | null;
  onCreate: (encounter: EncounterDraft) => Promise<boolean>;
  onUpdate: (encounterId: string, patch: EncounterDraft) => Promise<boolean>;
  onRemove: (encounterId: string) => Promise<boolean>;
  onCreateEntity: (encounterId: string, entity: EncounterEntityInput) => Promise<boolean>;
  onUpdateEntity: (encounterId: string, referenceId: string, entity: EncounterEntityInput) => Promise<boolean>;
}

export function SceneEncounterSection({ scene, disabled, error, onCreate, onUpdate, onRemove,
  onCreateEntity, onUpdateEntity }: SceneEncounterSectionProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EncounterDraft>(EMPTY_DRAFT);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const selected = scene.document.encounters.find((encounter) => encounter.id === selectedId) ?? null;
  const linkedPlacements = selected
    ? scene.document.preparedPlacements.filter((placement) => placement.encounterId === selected.id).length : 0;

  useEffect(() => {
    setSelectedId(null);
    setDraft(EMPTY_DRAFT);
    setConfirmRemove(false);
    setNotice(null);
  }, [scene.id]);

  useEffect(() => {
    if (!selectedId) return;
    const current = scene.document.encounters.find((encounter) => encounter.id === selectedId);
    if (current) setDraft({ name: current.name, kind: current.kind, description: current.description });
    else { setSelectedId(null); setDraft(EMPTY_DRAFT); }
  }, [scene.version, selectedId, scene.document.encounters]);

  const choose = (encounter: SceneEncounter | null) => {
    setSelectedId(encounter?.id ?? null);
    setDraft(encounter ? { name: encounter.name, kind: encounter.kind, description: encounter.description } : EMPTY_DRAFT);
    setConfirmRemove(false);
    setNotice(null);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setNotice(null);
    const payload = { ...draft, name: draft.name.trim(), description: draft.description.trim() };
    if (!payload.name) return;
    const saved = selected ? await onUpdate(selected.id, payload) : await onCreate(payload);
    if (saved) {
      if (!selected) choose(null);
      setNotice(selected ? 'Encounter aggiornato.' : 'Encounter creato.');
    }
  };

  const remove = async () => {
    if (!selected || !confirmRemove) return;
    setNotice(null);
    if (await onRemove(selected.id)) {
      choose(null);
      setNotice('Encounter rimosso.');
    } else setConfirmRemove(false);
  };

  return <section className="scene-encounters" aria-labelledby="scene-encounters-heading">
    <div className="scene-encounters__heading">
      <div>
        <p className="scene-catalog__eyebrow">Preparazione della scena</p>
        <h4 id="scene-encounters-heading">Encounter</h4>
        <p>Prepara incontri narrativi o di combattimento. Crearli non avvia il combattimento.</p>
      </div>
      <button type="button" className="secondary-button" disabled={disabled} onClick={() => choose(null)}>Nuovo encounter</button>
    </div>
    <div className="scene-encounters__layout">
      <nav aria-label="Encounter della scena">
        {scene.document.encounters.length ? <ul className="scene-encounters__list">
          {scene.document.encounters.map((encounter) => <li key={encounter.id}>
            <button type="button" aria-current={selectedId === encounter.id ? 'true' : undefined}
              onClick={() => choose(encounter)}>
              <strong>{encounter.name}</strong><span>{encounter.kind === 'combat' ? 'Combattimento' : encounter.kind === 'narrative' ? 'Narrativo' : 'Altro'}</span>
            </button>
          </li>)}
        </ul> : <p className="scene-catalog__hint">Nessun encounter preparato. Crea il primo per dare un nome alla situazione.</p>}
      </nav>
      <form className="scene-encounters__form" onSubmit={(event) => void submit(event)}>
        <strong>{selected ? `Modifica ${selected.name}` : 'Nuovo encounter'}</strong>
        <label>Nome
          <input required maxLength={120} value={draft.name} disabled={disabled}
            onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
        </label>
        <label>Tipo
          <select value={draft.kind} disabled={disabled}
            onChange={(event) => setDraft((current) => ({ ...current, kind: event.target.value as EncounterDraft['kind'] }))}>
            <option value="narrative">Narrativo</option>
            <option value="combat">Combattimento</option>
            <option value="other">Altro</option>
          </select>
        </label>
        <label>Descrizione (facoltativa)
          <textarea maxLength={2000} rows={3} value={draft.description} disabled={disabled}
            onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} />
        </label>
        <div className="scene-encounters__actions">
          {selected ? <button type="button" className="secondary-button" disabled={disabled || linkedPlacements > 0}
            onClick={() => setConfirmRemove(true)}>Rimuovi</button> : null}
          <button type="submit" className="primary-button" disabled={disabled || !draft.name.trim()}>
            {selected ? 'Salva encounter' : 'Crea encounter'}
          </button>
        </div>
        {linkedPlacements > 0 ? <p className="scene-catalog__hint">Rimuovi prima {linkedPlacements} placement collegati.</p> : null}
        {confirmRemove && selected ? <div className="scene-encounters__confirm" role="group" aria-label="Conferma rimozione encounter">
          <span>Rimuovere «{selected.name}»?</span>
          <button type="button" className="secondary-button" onClick={() => setConfirmRemove(false)}>Annulla</button>
          <button type="button" className="primary-button" disabled={disabled} onClick={() => void remove()}>Conferma rimozione</button>
        </div> : null}
        {notice ? <p className="scene-catalog__status" role="status">{notice}</p> : null}
      </form>
    </div>
    {selected ? <SceneEncounterEntitySection scene={scene} encounterId={selected.id} disabled={disabled}
      onCreate={onCreateEntity} onUpdate={onUpdateEntity} /> : null}
    {error ? <p className="scene-catalog__error" role="alert">{error}</p> : null}
  </section>;
}
