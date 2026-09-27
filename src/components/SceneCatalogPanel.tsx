import { useEffect, useState, type FormEvent } from 'react';
import { useSceneCatalog } from '../hooks/useSceneCatalog';
import { sceneBackgroundUrl } from '../utils/sceneApi';

export function SceneCatalogPanel() {
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

  useEffect(() => {
    setNameDraft(selectedScene?.name ?? '');
    setBackgroundDraft(null);
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
    if (await updateScene(nameDraft, backgroundDraft)) setBackgroundDraft(null);
  };

  return (
    <section className="sidebar__section scene-catalog" aria-labelledby="scene-catalog-heading">
      <div className="panel-heading panel-heading--compact">
        <div>
          <p className="scene-catalog__eyebrow">Preparazione</p>
          <h2 id="scene-catalog-heading">Scene</h2>
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

      {selectedScene ? (
        <form className="scene-catalog__detail" onSubmit={(event) => void submitUpdate(event)}>
          <div className="scene-catalog__detail-heading">
            <div>
              <p>Scena selezionata</p>
              <strong>{selectedScene.name}</strong>
            </div>
            <span>v{selectedScene.version}</span>
          </div>
          <label htmlFor="scene-name-draft">Nome</label>
          <input
            id="scene-name-draft"
            value={nameDraft}
            onChange={(event) => setNameDraft(event.target.value)}
            maxLength={120}
            disabled={isMutating}
          />
          <fieldset className="scene-catalog__background">
            <legend>Sfondo board</legend>
            {(previewUrl ?? (backgroundDraft === 'blank' ? null : sceneBackgroundUrl(selectedScene))) ? (
              <img src={previewUrl ?? sceneBackgroundUrl(selectedScene) ?? ''} alt="Anteprima dello sfondo della scena" />
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
            <small>JPEG, PNG o WebP · massimo 10 MB. La scelta resta in bozza fino al salvataggio.</small>
          </fieldset>
          <p className="scene-catalog__hint">La selezione apre solo la preparazione: non cambia ciò che vedono i Player.</p>
          <div className="scene-catalog__draft-actions">
            <button type="button" className="secondary-button" disabled={isMutating || (nameDraft === selectedScene.name && backgroundDraft === null)} onClick={() => { setNameDraft(selectedScene.name); setBackgroundDraft(null); }}>
              Annulla
            </button>
            <button
              type="submit"
              className="primary-button"
              disabled={isMutating || nameDraft.trim().length === 0 || (nameDraft.trim() === selectedScene.name && backgroundDraft === null)}
            >
              {isMutating ? 'Salvataggio...' : 'Salva modifiche'}
            </button>
          </div>
        </form>
      ) : (
        <p className="scene-catalog__hint">Seleziona una scena per modificarne le proprietà.</p>
      )}
    </section>
  );
}
