import type { EncounterEntityInput, PersistedScene } from '../utils/sceneApi';
import { SceneEncounterEntitySection } from './SceneEncounterEntitySection';
import { SceneEncounterPlacementSection, type EncounterPlacementActions, type PlacementPreview } from './SceneEncounterPlacementSection';

interface Props extends EncounterPlacementActions {
  scene: PersistedScene;
  encounterId: string | null;
  disabled: boolean;
  error: string | null;
  onSelectEncounter: (encounterId: string) => void;
  onGoToEncounters: () => void;
  onCreateEntity: (encounterId: string, entity: EncounterEntityInput) => Promise<boolean>;
  onUpdateEntity: (encounterId: string, referenceId: string, entity: EncounterEntityInput) => Promise<boolean>;
  placementPreview: PlacementPreview;
}

export function SceneCreaturePreparationSection({ scene, encounterId, disabled, error,
  onSelectEncounter, onGoToEncounters, onCreateEntity, onUpdateEntity, placementPreview,
  onOpenSheet, onUndoPlacement, onCreatePlacement, onUpdatePlacement, onRemovePlacement }: Props) {
  const selected = scene.document.encounters.find((encounter) => encounter.id === encounterId) ?? null;

  return <section className="scene-creature-preparation" aria-label="Preparazione mostri e PNG">
    <div className="scene-creature-preparation__context scene-encounters__form">
      {scene.document.encounters.length ? <>
        <div className="scene-creature-preparation__field">
          <label htmlFor="scene-creature-encounter">Encounter delle figure</label>
          <select id="scene-creature-encounter" value={selected?.id ?? ''} disabled={disabled}
            onChange={(event) => onSelectEncounter(event.target.value)}>
            <option value="">Scegli un encounter</option>
            {scene.document.encounters.map((encounter) => <option key={encounter.id} value={encounter.id}>{encounter.name}</option>)}
          </select>
        </div>
        <p className="scene-catalog__hint">{selected
          ? `Stai preparando le figure di «${selected.name}».`
          : 'Scegli un encounter salvato per aggiungere mostri, PNG e collocarli sulla mappa.'}</p>
      </> : <>
        <p className="scene-catalog__hint">Non ci sono encounter in questa scena. Creane uno prima di aggiungere mostri o PNG, oppure continua al riepilogo.</p>
        <button type="button" className="secondary-button" disabled={disabled} onClick={onGoToEncounters}>Vai a Encounter</button>
      </>}
    </div>
    {selected ? <>
      <SceneEncounterEntitySection key={`entity-${scene.id}-${selected.id}`} scene={scene} encounterId={selected.id}
        disabled={disabled} onCreate={onCreateEntity} onUpdate={onUpdateEntity} />
      <SceneEncounterPlacementSection key={`placement-${scene.id}-${selected.id}`} scene={scene} encounterId={selected.id}
        disabled={disabled} preview={placementPreview} onOpenSheet={onOpenSheet} onUndoPlacement={onUndoPlacement}
        onCreatePlacement={onCreatePlacement} onUpdatePlacement={onUpdatePlacement} onRemovePlacement={onRemovePlacement} />
    </> : null}
    {error ? <p className="scene-catalog__error" role="alert">{error}</p> : null}
  </section>;
}
