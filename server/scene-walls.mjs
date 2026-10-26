import { normalizeSceneWalls } from '../shared/scene-model.mjs';
export class SceneWalls {
  constructor(service) {
    this.service = service;
    this.history = new Map();
  }
  state(id) {
    const h = this.history.get(id);
    return { canUndo: !!h?.undo.length, canRedo: !!h?.redo.length };
  }
  mutate(id, expectedVersion, operation, value) {
    const current = this.service.versionedScene(id, expectedVersion);
    const before = current.document.walls ?? [];
    let history = this.history.get(id) ?? { undo: [], redo: [] };
    // An external replacement invalidates command history.
    if (history.current && JSON.stringify(history.current) !== JSON.stringify(before)) history = { undo: [], redo: [] };
    let after;
    if (operation === 'add') after = normalizeSceneWalls([...before, value]);
    else if (operation === 'remove') {
      if (!before.some((w) => w.id === value)) throw new TypeError('Muro non trovato.');
      after = before.filter((w) => w.id !== value);
    } else {
      const stack = history[operation];
      if (!stack?.length) throw new TypeError('Nessuna operazione muri disponibile.');
      after = stack.at(-1);
    }
    const saved = this.service.updateScene({
      id,
      expectedVersion,
      name: current.name,
      sortOrder: current.sortOrder,
      document: { ...current.document, walls: after },
    });
    if (operation === 'undo') {
      history.undo.pop();
      history.redo.push(before);
    } else if (operation === 'redo') {
      history.redo.pop();
      history.undo.push(before);
    } else {
      history.undo.push(before);
      history.undo = history.undo.slice(-40);
      history.redo = [];
    }
    history.current = after;
    this.history.set(id, history);
    return saved;
  }
}
