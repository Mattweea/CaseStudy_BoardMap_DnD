import type {
  DiagonalRule,
  GridPosition,
  LightSource,
  MeasurementUnit,
} from '../src/types';

export const SCENE_DOCUMENT_VERSION: 1;

export const SCENE_LIMITS: Readonly<{
  maxDocumentBytes: number;
  maxIdLength: number;
  maxNameLength: number;
  maxReferenceTypeLength: number;
  maxLayerItems: number;
  maxDrawingPoints: number;
  maxCoordinateMagnitude: number;
  maxLightRadiusCells: number;
}>;

export class SceneValidationError extends Error {
  path: string;
  constructor(message: string, path?: string);
}

export interface BlankSceneBackground {
  kind: 'blank';
}

export interface SceneBoardConfig {
  diagonalRule: DiagonalRule;
  measurementUnit: MeasurementUnit;
  isBackgroundHidden: boolean;
  isFullyLit: boolean;
  lightSources: LightSource[];
}

export interface SceneDrawing {
  id: string;
  points: GridPosition[];
  [key: string]: unknown;
}

export interface SceneElement {
  id: string;
  position: GridPosition;
  [key: string]: unknown;
}

export interface SceneEntityReference {
  id: string;
  entityType: string;
  entityId: string;
}

export interface ScenePreparedPlacement {
  id: string;
  entityReferenceId: string;
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
  background: BlankSceneBackground;
  board: SceneBoardConfig;
  drawings: SceneDrawing[];
  elements: SceneElement[];
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
export function captureSceneConfiguration(scene: unknown): SceneConfigurationDocument;
export function projectSceneRuntime(
  configuration: unknown,
  runtime?: SceneRuntime,
): SceneDocument;
