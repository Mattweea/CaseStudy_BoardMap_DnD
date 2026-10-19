import type { BoardDimensions, GridPosition, UnitToken } from '../types';
import { SCENE_LIMITS } from '../../shared/scene-model.mjs';

// La camera resta su celle intere: griglia, etichette e coordinate dei token
// condividono così la stessa origine anche durante una camminata interpolata.
export function clampCamera(position: GridPosition, dimensions: BoardDimensions, viewport: BoardDimensions): GridPosition {
  const unlimited = dimensions.columns === 0 && dimensions.rows === 0;
  const columns = unlimited ? SCENE_LIMITS.maxCoordinateMagnitude : dimensions.columns;
  const rows = unlimited ? SCENE_LIMITS.maxCoordinateMagnitude : dimensions.rows;
  return {
    x: Math.min(Math.max(0, Math.round(position.x)), Math.max(0, Math.ceil(columns - viewport.columns))),
    y: Math.min(Math.max(0, Math.round(position.y)), Math.max(0, Math.ceil(rows - viewport.rows))),
  };
}

export function cameraFollowingPosition(
  camera: GridPosition,
  position: GridPosition,
  footprint: { width: number; height: number },
  viewport: BoardDimensions,
  dimensions: BoardDimensions,
): GridPosition {
  if (viewport.columns <= 0 || viewport.rows <= 0) return camera;
  const followAxis = (origin: number, start: number, size: number, visible: number) => {
    if (size > visible) return Math.round(start + (size - visible) / 2);
    if (start < origin) return Math.floor(start);
    if (start + size > origin + visible) return Math.ceil(start + size - visible);
    return origin;
  };
  const next = clampCamera({
    x: followAxis(camera.x, position.x, footprint.width, viewport.columns),
    y: followAxis(camera.y, position.y, footprint.height, viewport.rows),
  }, dimensions, viewport);
  return next.x === camera.x && next.y === camera.y ? camera : next;
}

export function resolveFollowTokenId(
  tokens: UnitToken[],
  isMaster: boolean,
  selectedTokenIds: string[],
  playerTokenId: string | null,
): string | null {
  const id = isMaster ? (selectedTokenIds.length === 1 ? selectedTokenIds[0] : null) : playerTokenId;
  const token = tokens.find((candidate) => candidate.id === id);
  return token?.type === 'player' && token.isFamiliar !== true ? token.id : null;
}

export function walkingTokenPosition(
  token: UnitToken,
  tokens: UnitToken[],
  positions: Record<string, GridPosition>,
): GridPosition | undefined {
  if (positions[token.id]) return positions[token.id];
  const vehicle = tokens.find((candidate) => candidate.type === 'vehicle'
    && (candidate.id === token.containedInVehicleId || candidate.vehicleOccupantIds?.includes(token.id)));
  const vehiclePosition = vehicle && positions[vehicle.id];
  if (!vehicle || !vehiclePosition) return undefined;
  return {
    x: vehiclePosition.x + token.position.x - vehicle.position.x,
    y: vehiclePosition.y + token.position.y - vehicle.position.y,
  };
}
