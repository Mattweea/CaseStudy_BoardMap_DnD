import { useEffect, useState, type FormEvent } from 'react';
import { useSceneCatalog } from '../hooks/useSceneCatalog';
import { sceneBackgroundUrl } from '../utils/sceneApi';

const DEFAULT_CALIBRATION = { scale: 1, offsetX: 0, offsetY: 0 };

function sceneCalibration(scene: ReturnType<typeof useSceneCatalog>['selectedScene']) {
  return scene?.document.background.kind === 'image'
    ? {
        scale: scene.document.background.scale,
        offsetX: scene.document.background.offsetX,
        offsetY: scene.document.background.offsetY,
      }
    : DEFAULT_CALIBRATION;
}

interface SceneCatalogPanelProps {
  isActiveSceneBackgroundHidden: boolean;
  onActiveSceneBackgroundVisibilityChange: (hidden: boolean) => Promise<void>;
}

export function SceneCatalogPanel({
  isActiveSceneBackgroundHidden,
  onActiveSceneBackgroundVisibilityChange,
}: SceneCatalogPanelProps) {
  const {
    catalog,
    selectedScene,
    isLoading,
    isMutating,
    error,
    reload,
    selectScene,
    createScene,
    updateScene,
  } = useSceneCatalog(true);
  const [newName, setNewName] = useState('');
  const [nameDraft, setNameDraft] = useState('');
  const [backgroundDraft, setBackgroundDraft] = useState<File | 'blank' | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [calibrationDraft, setCalibrationDraft] = useState(DEFAULT_CALIBRATION);
  const [previewImageSize, setPreviewImageSize] = useState<{ width: number; height: number } | null>(null);
  const [isChangingVisibility, setIsChangingVisibility] = useState(false);

  useEffect(() => {
    setNameDraft(selectedScene?.name ?? '');
    setBackgroundDraft(null);
    setCalibrationDraft(sceneCalibration(selectedScene));
  }, [selectedScene]);

  useEffect(() => {
    if (!(backgroundDraft instanceof File)) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(backgroundDraft);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [backgroundDraft]);

  const submitCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (await createScene(newName)) setNewName('');
  };

  const submitUpdate = async (event: FormEvent) => {
    event.preventDefault();
    const hasImage = backgroundDraft instanceof File
      || (backgroundDraft !== 'blank' && selectedScene?.document.background.kind === 'image');
    if (await updateScene(nameDraft, backgroundDraft, hasImage ? calibrationDraft : null)) {
      setBackgroundDraft(null);
    }
  };

  const persistedCalibration = sceneCalibration(selectedScene);
  const calibrationChanged = calibrationDraft.scale !== persistedCalibration.scale
    || calibrationDraft.offsetX !== persistedCalibration.offsetX
    || calibrationDraft.offsetY !== persistedCalibration.offsetY;
  const imageSource = previewUrl ?? (backgroundDraft === 'blank' || !selectedScene
    ? null
    : sceneBackgroundUrl(selectedScene));
  const hasImage = backgroundDraft instanceof File
    || (backgroundDraft !== 'blank' && selectedScene?.document.background.kind === 'image');
  const hasDraftChanges = selectedScene !== null && (
    nameDraft.trim() !== selectedScene.name
    || backgroundDraft !== null
    || (hasImage && calibrationChanged)
  );
  const previewBoard = selectedScene?.document.board.dimensions ?? { columns: 30, rows: 30 };
  const previewBoardWidth = previewBoard.columns * 48;

  const changeActiveBackgroundVisibility = async () => {
    if (!selectedScene?.isActive || hasDraftChanges) return;
    const sceneId = selectedScene.id;
    setIsChangingVisibility(true);
    try {
      await onActiveSceneBackgroundVisibilityChange(!isActiveSceneBackgroundHidden);
      await selectScene(sceneId);
    } finally {
      setIsChangingVisibility(false);
    }
  };

  useEffect(() => {
    setPreviewImageSize(null);
  }, [imageSource]);

  return (
    <section className="scene-catalog" aria-label="Catalogo e preparazione delle scene">
      <aside className="scene-catalog__rail" aria-labelledby="scene-catalog-list-heading">
        <div className="scene-catalog__rail-heading">
          <div>
            <p className="scene-catalog__eyebrow">Archivio del Master</p>
            <h3 id="scene-catalog-list-heading">Catalogo</h3>
          </div>
          <button type="button" className="scene-catalog__refresh" onClick={() => void reload()} disabled={isLoading || isMutating}>
            Aggiorna
          </button>
        </div>

        <form className="scene-catalog__create" onSubmit={(event) => void submitCreate(event)}>
          <label htmlFor="new-scene-name">Nuova scena</label>
          <div className="scene-catalog__inline-form">
            <input
              id="new-scene-name"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="Es. Cripta sommersa"
              maxLength={120}
              disabled={isMutating}
            />
            <button type="submit" className="primary-button" disabled={isMutating || newName.trim().length === 0}>
              Crea
            </button>
          </div>
        </form>

        {error ? <p className="scene-catalog__error" role="alert">{error}</p> : null}
        {isLoading ? <p className="scene-catalog__status" role="status">Caricamento scene...</p> : null}

        {!isLoading && catalog.length === 0 ? (
          <p className="scene-catalog__empty">Crea la prima scena per iniziare a preparare la campagna.</p>
        ) : (
          <ul className="scene-catalog__list" aria-label="Catalogo scene">
            {catalog.map((scene) => (
              <li key={scene.id}>
                <button
                  type="button"
                  className={selectedScene?.id === scene.id ? 'scene-catalog__item scene-catalog__item--selected' : 'scene-catalog__item'}
                  aria-pressed={selectedScene?.id === scene.id}
                  onClick={() => void selectScene(scene.id)}
                  disabled={isLoading}
                >
                  <span>{scene.name}</span>
                  <small>{scene.isActive ? 'Attiva' : `v${scene.version}`}</small>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      <div className="scene-catalog__workspace">
        {selectedScene ? (
          <form className="scene-catalog__detail" onSubmit={(event) => void submitUpdate(event)}>
            <div className="scene-catalog__detail-heading">
              <div>
                <p>Scena selezionata</p>
                <strong>{selectedScene.name}</strong>
              </div>
              <span>Versione {selectedScene.version}</span>
            </div>
            <label htmlFor="scene-name-draft">Nome della scena</label>
            <input
              id="scene-name-draft"
              value={nameDraft}
              onChange={(event) => setNameDraft(event.target.value)}
              maxLength={120}
              disabled={isMutating}
            />
            <fieldset className="scene-catalog__background">
              <legend>Sfondo e allineamento</legend>
              {imageSource ? (
                <div
                  className="scene-catalog__calibration-preview"
                  style={{ aspectRatio: `${previewBoard.columns} / ${previewBoard.rows}` }}
                >
                  <img
                    src={imageSource}
                    alt="Anteprima dello sfondo calibrato rispetto alla griglia"
                    onLoad={(event) => setPreviewImageSize({
                      width: event.currentTarget.naturalWidth,
                      height: event.currentTarget.naturalHeight,
                    })}
                    style={{
                      left: `${calibrationDraft.offsetX / previewBoardWidth * 100}%`,
                      top: `${calibrationDraft.offsetY / (previewBoard.rows * 48) * 100}%`,
                      width: previewImageSize
                        ? `${previewImageSize.width * calibrationDraft.scale / previewBoardWidth * 100}%`
                        : 'auto',
                      height: previewImageSize
                        ? `${previewImageSize.height * calibrationDraft.scale / (previewBoard.rows * 48) * 100}%`
                        : 'auto',
                    }}
                  />
                  <span
                    aria-hidden="true"
                    style={{ backgroundSize: `${100 / previewBoard.columns}% ${100 / previewBoard.rows}%` }}
                  />
                </div>
              ) : (
                <div className="scene-catalog__blank-preview">Board bianca con griglia</div>
              )}
              <div className="scene-catalog__background-actions">
                <label className="secondary-button">
                  Scegli immagine
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={isMutating}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) setBackgroundDraft(file);
                      event.target.value = '';
                    }}
                  />
                </label>
                <button type="button" className="secondary-button" disabled={isMutating} onClick={() => setBackgroundDraft('blank')}>
                  Usa board bianca
                </button>
              </div>
              <div className="scene-catalog__calibration-controls" aria-label="Calibrazione sfondo sulla griglia">
                <label>
                  Scala
                  <input type="number" min="0.05" max="20" step="0.05" value={calibrationDraft.scale} disabled={isMutating || !hasImage} onChange={(event) => setCalibrationDraft((current) => ({ ...current, scale: Number(event.target.value) }))} />
                </label>
                <label>
                  Offset X (px)
                  <input type="number" min="-1000000" max="1000000" step="1" value={calibrationDraft.offsetX} disabled={isMutating || !hasImage} onChange={(event) => setCalibrationDraft((current) => ({ ...current, offsetX: Number(event.target.value) }))} />
                </label>
                <label>
                  Offset Y (px)
                  <input type="number" min="-1000000" max="1000000" step="1" value={calibrationDraft.offsetY} disabled={isMutating || !hasImage} onChange={(event) => setCalibrationDraft((current) => ({ ...current, offsetY: Number(event.target.value) }))} />
                </label>
              </div>
              <small>JPEG, PNG o WebP · massimo 10 MB. La scelta resta in bozza fino al salvataggio.</small>
            </fieldset>
            <div className={`scene-catalog__visibility ${selectedScene.isActive ? 'scene-catalog__visibility--active' : ''}`}>
              <div>
                <span className="scene-catalog__visibility-label">Visibilità sulla board</span>
                <strong>
                  {selectedScene.isActive
                    ? isActiveSceneBackgroundHidden ? 'Sfondo nascosto' : 'Sfondo visibile'
                    : 'Scena non attiva'}
                </strong>
                <p>
                  {selectedScene.isActive
                    ? isActiveSceneBackgroundHidden
                      ? 'La griglia resta disponibile, ma l’immagine non è mostrata ai partecipanti.'
                      : 'L’immagine salvata è mostrata sulla board del Master e dei Player.'
                    : 'La visibilità può essere cambiata soltanto per la scena attualmente attiva.'}
                </p>
              </div>
              {selectedScene.isActive ? (
                <button
                  type="button"
                  className={isActiveSceneBackgroundHidden ? 'primary-button' : 'secondary-button'}
                  aria-pressed={!isActiveSceneBackgroundHidden}
                  disabled={isMutating || isChangingVisibility || hasDraftChanges || selectedScene.document.background.kind !== 'image'}
                  title={selectedScene.document.background.kind !== 'image'
                    ? 'Salva prima un’immagine di sfondo'
                    : hasDraftChanges
                      ? 'Salva o annulla le modifiche prima di cambiare la visibilità'
                      : undefined}
                  onClick={() => void changeActiveBackgroundVisibility()}
                >
                  {isChangingVisibility
                    ? 'Aggiornamento...'
                    : isActiveSceneBackgroundHidden ? 'Mostra sfondo' : 'Nascondi sfondo'}
                </button>
              ) : null}
            </div>
            <p className="scene-catalog__hint">Stai modificando la preparazione: la scena mostrata ai Player non cambia finché non viene attivata.</p>
            <div className="scene-catalog__draft-actions">
              <button type="button" className="secondary-button" disabled={isMutating || !hasDraftChanges} onClick={() => { setNameDraft(selectedScene.name); setBackgroundDraft(null); setCalibrationDraft(sceneCalibration(selectedScene)); }}>
                Annulla
              </button>
              <button type="submit" className="primary-button" disabled={isMutating || nameDraft.trim().length === 0 || !hasDraftChanges}>
                {isMutating ? 'Salvataggio...' : 'Salva modifiche'}
              </button>
            </div>
          </form>
        ) : (
          <div className="scene-catalog__empty-workspace">
            <span aria-hidden="true">⌖</span>
            <strong>Scegli una scena dal catalogo</strong>
            <p>Qui avrai spazio per rinominarla, sostituire lo sfondo e allinearlo alla griglia.</p>
          </div>
        )}
      </div>
    </section>
  );
}
