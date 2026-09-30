import { footprintsOverlap } from '../shared/scene-blockers.mjs';

export class PartyTransferError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'PartyTransferError';
    this.statusCode = statusCode;
  }
}

function cellsOfVehicle(position, footprint) {
  const cells = [];
  for (let y = 0; y < footprint.height; y += 1) {
    for (let x = 0; x < footprint.width; x += 1) cells.push({ x: position.x + x, y: position.y + y });
  }
  return cells;
}

function* candidatePositions(anchor, maxRadius) {
  for (let radius = 0; radius <= maxRadius; radius += 1) {
    if (radius === 0) { yield anchor; continue; }
    for (let x = anchor.x - radius; x <= anchor.x + radius; x += 1) {
      if (x >= 0 && anchor.y - radius >= 0) yield { x, y: anchor.y - radius };
      if (x >= 0) yield { x, y: anchor.y + radius };
    }
    for (let y = anchor.y - radius + 1; y < anchor.y + radius; y += 1) {
      if (y >= 0 && anchor.x - radius >= 0) yield { x: anchor.x - radius, y };
      if (y >= 0) yield { x: anchor.x + radius, y };
    }
  }
}

export function planPartyTransfer({ sourceTokens, targetTokens, targetScene, anchor, profiles, getTokenFootprint }) {
  if (!Number.isSafeInteger(anchor?.x) || !Number.isSafeInteger(anchor?.y)
    || anchor.x < 0 || anchor.y < 0 || anchor.x > 1_000_000 || anchor.y > 1_000_000) {
    throw new PartyTransferError('Scegli una cella ancora valida.');
  }
  const sourceIds = new Set();
  for (const token of sourceTokens) {
    if (sourceIds.has(token.id)) throw new PartyTransferError('La scena sorgente contiene ID token duplicati.', 409);
    sourceIds.add(token.id);
  }
  const targetIds = new Set(targetTokens.map((token) => token.id));
  if (targetIds.size !== targetTokens.length) throw new PartyTransferError('La scena attiva contiene ID token duplicati.', 409);
  const rosterByOwner = new Map(profiles.filter((profile) => profile.spawnToken).map((profile) => [profile.id, profile]));
  const rosterByKey = new Map(profiles.filter((profile) => profile.spawnToken).map((profile) => [profile.key, profile]));
  const rosterTokens = sourceTokens.filter((token) => token.type === 'player' && token.isFamiliar !== true
    && (rosterByOwner.has(token.ownerUserId) || rosterByKey.has(token.characterKey)));
  if (!rosterTokens.length) throw new PartyTransferError('Nessun personaggio del party nella scena sorgente.', 409);
  const owners = new Set();
  for (const token of rosterTokens) {
    const ownerProfile = rosterByOwner.get(token.ownerUserId);
    const keyProfile = rosterByKey.get(token.characterKey);
    if (ownerProfile && keyProfile && ownerProfile.id !== keyProfile.id) {
      throw new PartyTransferError('Un personaggio ha identità roster incoerenti.', 409);
    }
    const profile = ownerProfile ?? keyProfile;
    if (token.ownerUserId !== profile.id || token.characterKey !== profile.key) {
      throw new PartyTransferError('Un personaggio non ha ownership e identità roster canoniche.', 409);
    }
    if (owners.has(profile.id)) throw new PartyTransferError('Il party contiene personaggi duplicati.', 409);
    if (targetTokens.some((target) => target.type === 'player' && target.isFamiliar !== true
      && (target.ownerUserId === profile.id || target.characterKey === profile.key))) {
      throw new PartyTransferError('Un personaggio del party è già nella scena attiva.', 409);
    }
    owners.add(profile.id);
  }
  const members = new Map(rosterTokens.map((token) => [token.id, token]));
  for (const token of sourceTokens) {
    if (token.isFamiliar === true && owners.has(token.ownerUserId)) members.set(token.id, token);
  }
  for (const vehicle of sourceTokens.filter((token) => token.type === 'vehicle')) {
    const occupantIds = vehicle.vehicleOccupantIds ?? [];
    if (!occupantIds.some((id) => members.has(id))) continue;
    if (new Set(occupantIds).size !== occupantIds.length || occupantIds.some((id) => !members.has(id))) {
      throw new PartyTransferError('Un veicolo del party contiene occupanti estranei o mancanti.', 409);
    }
    members.set(vehicle.id, vehicle);
  }
  for (const token of members.values()) {
    if (targetIds.has(token.id)) throw new PartyTransferError('Un token del party esiste già nella scena attiva.', 409);
    if (token.containedInVehicleId && !members.has(token.containedInVehicleId)) {
      throw new PartyTransferError('Una relazione veicolo del party non è valida.', 409);
    }
  }
  const dimensions = targetScene.document.board.dimensions;
  if (dimensions.columns > 0 && (anchor.x >= dimensions.columns || anchor.y >= dimensions.rows)) {
    throw new PartyTransferError('La cella ancora è fuori dalla scena attiva.');
  }
  const obstacles = [
    ...targetTokens.map((token) => ({ position: token.position, widthCells: getTokenFootprint(token).width,
      heightCells: getTokenFootprint(token).height })),
    ...targetScene.document.elements.filter((element) => element.blocksMovement),
  ];
  const roots = [...members.values()].filter((token) => !token.containedInVehicleId)
    .sort((left, right) => (left.type === 'vehicle' ? -1 : 0) - (right.type === 'vehicle' ? -1 : 0)
      || left.id.localeCompare(right.id));
  const placements = new Map();
  const placedFootprints = [];
  const maxRadius = dimensions.columns > 0 ? Math.max(dimensions.columns, dimensions.rows) : 1000;
  for (const token of roots) {
    const footprint = getTokenFootprint(token);
    let placed = null;
    for (const position of candidatePositions(anchor, maxRadius)) {
      if (position.x + footprint.width > 1_000_001 || position.y + footprint.height > 1_000_001) continue;
      if (dimensions.columns > 0
        && (position.x + footprint.width > dimensions.columns || position.y + footprint.height > dimensions.rows)) continue;
      if (obstacles.some((obstacle) => footprintsOverlap(position, footprint, obstacle))
        || placedFootprints.some((obstacle) => footprintsOverlap(position, footprint, obstacle))) continue;
      placed = position;
      break;
    }
    if (!placed) throw new PartyTransferError('Spazio insufficiente per trasferire il party.', 409);
    placements.set(token.id, placed);
    placedFootprints.push({ position: placed, widthCells: footprint.width, heightCells: footprint.height });
    if (token.type === 'vehicle') {
      const cells = cellsOfVehicle(placed, footprint);
      (token.vehicleOccupantIds ?? []).forEach((id, index) => placements.set(id, cells[index] ?? placed));
    }
  }
  const transferred = [...members.values()].map((token) => ({ ...token, position: placements.get(token.id) }));
  return {
    transferred,
    remaining: sourceTokens.filter((token) => !members.has(token.id)),
    placements: transferred.map((token) => ({ tokenId: token.id, position: token.position })),
  };
}
