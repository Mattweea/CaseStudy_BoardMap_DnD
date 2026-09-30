import type {
  DiagonalRule,
  GridPosition,
  LightSource,
  MeasurementUnit,
  UnitToken,
} from '../src/types';

export const SCENE_DOCUMENT_VERSION: 1;

export const SCENE_LIMITS: Readonly<{
  maxDocumentBytes: number;
  maxIdLength: number;
  maxNameLength: number;
  maxReferenceTypeLength: number;
  maxLayerItems: number;
  maxDrawingPoints: number;
  maxElementFootprintCells: number;
  minDrawingWidthCells: number;
  maxDrawingWidthCells: number;
  maxCoordinateMagnitude: number;
  maxLightRadiusCells: number;
  maxBoardDimensionCells: number;
  minBackgroundScale: number;
  maxBackgroundScale: number;
  maxBackgroundOffsetPixels: number;
}>;

export class SceneValidationError extends Error {
  path: string;
  constructor(message: string, path?: string);
}

export const SCENE_ELEMENT_KINDS: readonly ['rock', 'crate', 'table'];
export const SCENE_ENCOUNTER_KINDS: readonly ['combat', 'narrative', 'other'];
export const SCENE_ENTITY_KINDS: readonly ['monster', 'npc'];

export interface SceneEncounter {
  id: string;
  name: string;
  kind: (typeof SCENE_ENCOUNTER_KINDS)[number];
  description: string;
}

export interface BlankSceneBackground {
  kind: 'blank';
}

export interface ImageSceneBackground {
  kind: 'image';
  assetId: string;
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp';
  byteLength: number;
  etag: string;
  updatedAt: string;
  scale: number;
  offsetX: number;
  offsetY: number;
}

export type SceneBackground = BlankSceneBackground | ImageSceneBackground;

export interface SceneBoardConfig {
  diagonalRule: DiagonalRule;
  measurementUnit: MeasurementUnit;
  dimensions: { columns: number; rows: number };
  isBackgroundHidden: boolean;
  isFullyLit: boolean;
  lightSources: LightSource[];
}

export interface SceneDrawing {
  id: string;
  points: Array<{ x: number; y: number }>;
  color: string;
  widthCells: number;
}

export interface SceneElement {
  id: string;
  kind: (typeof SCENE_ELEMENT_KINDS)[number];
  position: GridPosition;
  widthCells: number;
  heightCells: number;
  rotation: number;
  blocksMovement: boolean;
  blocksVision: boolean;
}

export interface SceneEntityReference {
  id: string;
  entityType: string;
  entityId: string;
  encounterId?: string;
  name?: string;
  tokenProperties?: EncounterTokenProperties;
}

export type EncounterTokenProperties = Partial<Pick<UnitToken,
  'size' | 'widthCells' | 'heightCells' | 'color' | 'initiativeModifier' |
  'movementCells' | 'hitPoints' | 'maxHitPoints' | 'isInvisible' | 'excludeFromInitiative'>>;

export interface SceneEncounterEntityReference extends SceneEntityReference {
  entityType: (typeof SCENE_ENTITY_KINDS)[number];
  encounterId: string;
  name: string;
}

export interface ScenePreparedPlacement {
  id: string;
  entityReferenceId: string;
  encounterId?: string;
  position: GridPosition;
  [key: string]: unknown;
}

export interface SceneRuntimeToken {
  id: string;
  position: GridPosition;
  [key: string]: unknown;
}

export interface SceneRuntime {
  tokens: SceneRuntimeToken[];
}

export interface SceneConfigurationDocument {
  schemaVersion: typeof SCENE_DOCUMENT_VERSION;
  background: SceneBackground;
  board: SceneBoardConfig;
  drawings: SceneDrawing[];
  elements: SceneElement[];
  encounters: SceneEncounter[];
  entityReferences: SceneEntityReference[];
  preparedPlacements: ScenePreparedPlacement[];
}

export interface SceneDocument extends SceneConfigurationDocument {
  runtime: SceneRuntime;
}

export interface SceneMetadata {
  id: string;
  name: string;
  version: number;
}

export interface Scene extends SceneMetadata {
  document: SceneDocument;
}

export function createDefaultSceneDocument(): SceneDocument;
export function normalizeSceneMetadata(value: unknown): SceneMetadata;
export function normalizeScene(value: unknown): Scene;
export function normalizeSceneDocument(value: unknown): SceneDocument;
export function normalizeSceneDrawings(value: unknown): SceneDrawing[];
export function normalizeSceneElements(value: unknown, dimensions?: { columns: number; rows: number }): SceneElement[];
export function normalizeSceneEncounters(value: unknown): SceneEncounter[];
export function captureSceneConfiguration(scene: unknown): SceneConfigurationDocument;
export function projectSceneRuntime(
  configuration: unknown,
  runtime?: SceneRuntime,
): SceneDocument;
