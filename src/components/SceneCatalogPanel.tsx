import { useEffect, useState, type FormEvent } from 'react';
import { useSceneCatalog } from '../hooks/useSceneCatalog';

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

  useEffect(() => {
    setNameDraft(selectedScene?.name ?? '');
  }, [selectedScene]);

  const submitCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (await createScene(newName)) setNewName('');
  };

  const submitUpdate = async (event: FormEvent) => {
    event.preventDefault();
    await updateScene(nameDraft);
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
          <p className="scene-catalog__hint">La selezione apre solo la preparazione: non cambia ciò che vedono i Player.</p>
          <button
            type="submit"
            className="primary-button"
            disabled={isMutating || nameDraft.trim().length === 0 || nameDraft.trim() === selectedScene.name}
          >
            {isMutating ? 'Salvataggio...' : 'Salva modifiche'}
          </button>
        </form>
      ) : (
        <p className="scene-catalog__hint">Seleziona una scena per modificarne le proprietà.</p>
      )}
    </section>
  );
}
