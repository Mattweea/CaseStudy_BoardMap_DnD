import { projectEncounterEntityToken } from './encounter-token.mjs';

const footprint = (token) => ({
  width: token.widthCells ?? { large: 2, huge: 3, gargantuan: 4 }[token.size] ?? 1,
  height: token.heightCells ?? { large: 2, huge: 3, gargantuan: 4 }[token.size] ?? 1,
});
export function planEncounterBatch(document, encounterId, input, makeId = (i) => `preview-${i}`) {
  const { quantity = 1, ...placement } = input;
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100)
    throw new TypeError('Quantità: inserisci un intero da 1 a 100.');
  const entity = document.entityReferences.find(
    (e) => e.id === placement.entityReferenceId && e.encounterId === encounterId,
  );
  if (!entity) throw new TypeError('Scegli una figura valida di questo encounter.');
  const base = { ...placement, id: makeId(0), encounterId };
  if (quantity === 1) return [base];
  const size = footprint(projectEncounterEntityToken({ entity, placement: base }));
  const columns = document.board.dimensions.columns || 1_000_000;
  const rows = document.board.dimensions.rows || 1_000_000;
  if (
    !Number.isSafeInteger(placement.position?.x) ||
    !Number.isSafeInteger(placement.position?.y) ||
    placement.position.x < 0 ||
    placement.position.y < 0
  )
    throw new TypeError('Posizione non valida.');
  const occupied = document.preparedPlacements.map((p) => {
    const e = document.entityReferences.find((e) => e.id === p.entityReferenceId);
    return { position: p.position, ...footprint(projectEncounterEntityToken({ entity: e, placement: p })) };
  });
  const result = [];
  let x = placement.position.x,
    y = placement.position.y;
  for (let index = 0; index < quantity; index++) {
    let attempts = 0;
    while (true) {
      if (x + size.width > columns) {
        x = 0;
        y += size.height;
      }
      if (y + size.height > rows || ++attempts > 10000) throw new TypeError('Spazio insufficiente per il lotto.');
      const collides = occupied.some(
        (p) =>
          x < p.position.x + p.width &&
          x + size.width > p.position.x &&
          y < p.position.y + p.height &&
          y + size.height > p.position.y,
      );
      if (!collides || quantity === 1) break;
      x += size.width;
    }
    const candidate = {
      ...base,
      id: index === 0 ? base.id : makeId(index),
      position: { x, y },
      ...(quantity > 1 ? { name: `${entity.name.trim()} ${index + 1}` } : {}),
    };
    result.push(candidate);
    occupied.push({ position: candidate.position, ...size });
    x += size.width;
  }
  return result;
}
