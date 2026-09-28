// An axis-aligned footprint shared by scene elements and existing blocking tokens.
// Rotation changes presentation only; it never changes the occupied cells.
function tokenBlocker(token, getTokenFootprint) {
  const footprint = getTokenFootprint(token);
  return {
    id: token.id,
    source: 'token',
    name: token.name,
    groupId: token.groupId ?? null,
    position: token.position,
    widthCells: footprint.width,
    heightCells: footprint.height,
  };
}

function elementBlocker(element) {
  return {
    id: element.id,
    source: 'element',
    name: { rock: 'Roccia', crate: 'Cassa', table: 'Tavolo' }[element.kind] ?? 'Elemento scenico',
    groupId: null,
    position: element.position,
    widthCells: element.widthCells,
    heightCells: element.heightCells,
  };
}

export function collectMovementBlockers(tokens, elements, getTokenFootprint) {
  return [
    ...tokens.filter((token) => token.blocksMovement === true)
      .map((token) => tokenBlocker(token, getTokenFootprint)),
    ...elements.filter((element) => element.blocksMovement === true).map(elementBlocker),
  ];
}

export function collectVisionBlockers(tokens, elements, getTokenFootprint) {
  return [
    ...tokens.filter((token) => token.blocksMovement === true)
      .map((token) => tokenBlocker(token, getTokenFootprint)),
    ...elements.filter((element) => element.blocksVision === true).map(elementBlocker),
  ];
}

export function footprintsOverlap(position, footprint, blocker) {
  return position.x < blocker.position.x + blocker.widthCells
    && position.x + footprint.width > blocker.position.x
    && position.y < blocker.position.y + blocker.heightCells
    && position.y + footprint.height > blocker.position.y;
}
