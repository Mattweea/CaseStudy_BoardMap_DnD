export const SCENE_DOCUMENT_VERSION = 1;

export const SCENE_LIMITS = Object.freeze({
  maxDocumentBytes: 2 * 1024 * 1024,
  maxIdLength: 128,
  maxNameLength: 120,
  maxReferenceTypeLength: 64,
  maxLayerItems: 5000,
  maxDrawingPoints: 20000,
  minDrawingWidthCells: 0.05,
  maxDrawingWidthCells: 20,
  maxElementFootprintCells: 40,
  maxCoordinateMagnitude: 1_000_000,
  maxLightRadiusCells: 1000,
  maxBoardDimensionCells: 500,
  minBackgroundScale: 0.05,
  maxBackgroundScale: 20,
  maxBackgroundOffsetPixels: 1_000_000,
});

const DEFAULT_MEASUREMENT_UNIT = Object.freeze({
  label: 'm',
  cellsValue: 1.5,
});

export const SCENE_ELEMENT_KINDS = Object.freeze(['rock', 'crate', 'table']);
export const SCENE_ENCOUNTER_KINDS = Object.freeze(['combat', 'narrative', 'other']);

export class SceneValidationError extends Error {
  constructor(message, path = 'scene') {
    super(path + ': ' + message);
    this.name = 'SceneValidationError';
    this.path = path;
  }
}

function fail(path, message) {
  throw new SceneValidationError(message, path);
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function serializedByteLength(value, path = 'scene') {
  let serialized;
  try {
    serialized = JSON.stringify(value);
  } catch {
    fail(path, 'must be JSON serializable');
  }

  if (typeof serialized !== 'string') {
    fail(path, 'must be a JSON object');
  }

  return new TextEncoder().encode(serialized).byteLength;
}

function cloneJsonObject(value, path) {
  if (!isRecord(value)) {
    fail(path, 'must be an object');
  }

  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    fail(path, 'must be JSON serializable');
  }
}

function normalizeId(value, path) {
  if (typeof value !== 'string') {
    fail(path, 'must be a string');
  }

  const id = value.trim();
  if (!id) {
    fail(path, 'must not be empty');
  }
  if (id.length > SCENE_LIMITS.maxIdLength) {
    fail(path, 'must not exceed ' + SCENE_LIMITS.maxIdLength + ' characters');
  }

  return id;
}

function normalizeShortString(value, path, maxLength) {
  if (typeof value !== 'string') {
    fail(path, 'must be a string');
  }

  const normalized = value.trim();
  if (!normalized) {
    fail(path, 'must not be empty');
  }
  if (normalized.length > maxLength) {
    fail(path, 'must not exceed ' + maxLength + ' characters');
  }

  return normalized;
}

function normalizeCoordinate(value, path) {
  if (!Number.isSafeInteger(value)) {
    fail(path, 'must be a safe integer');
  }
  if (Math.abs(value) > SCENE_LIMITS.maxCoordinateMagnitude) {
    fail(
      path,
      'must be between -' + SCENE_LIMITS.maxCoordinateMagnitude
        + ' and ' + SCENE_LIMITS.maxCoordinateMagnitude,
    );
  }
  return value;
}

function normalizePosition(value, path) {
  if (!isRecord(value)) {
    fail(path, 'must be an object');
  }

  return {
    x: normalizeCoordinate(value.x, path + '.x'),
    y: normalizeCoordinate(value.y, path + '.y'),
  };
}

function normalizeCollection(value, path, normalizeItem) {
  if (!Array.isArray(value)) {
    fail(path, 'must be an array');
  }
  if (value.length > SCENE_LIMITS.maxLayerItems) {
    fail(path, 'must not contain more than ' + SCENE_LIMITS.maxLayerItems + ' items');
  }

  const seenIds = new Set();
  return value.map((item, index) => {
    const itemPath = path + '[' + index + ']';
    const normalized = normalizeItem(item, itemPath);
    if (seenIds.has(normalized.id)) {
      fail(itemPath + '.id', 'duplicates id "' + normalized.id + '"');
    }
    seenIds.add(normalized.id);
    return normalized;
  });
}

function normalizeLightSources(value, path) {
  return normalizeCollection(value, path, (item, itemPath) => {
    const cloned = cloneJsonObject(item, itemPath);
    const radiusCells = cloned.radiusCells;
    if (
      typeof radiusCells !== 'number'
      || !Number.isFinite(radiusCells)
      || radiusCells < 0
      || radiusCells > SCENE_LIMITS.maxLightRadiusCells
    ) {
      fail(
        itemPath + '.radiusCells',
        'must be between 0 and ' + SCENE_LIMITS.maxLightRadiusCells,
      );
    }

    return {
      ...cloned,
      id: normalizeId(cloned.id, itemPath + '.id'),
      position: normalizePosition(cloned.position, itemPath + '.position'),
      radiusCells,
    };
  });
}

function normalizeBoardConfig(value, path) {
  const board = value === undefined ? {} : cloneJsonObject(value, path);
  const diagonalRule = board.diagonalRule ?? 'standard';
  if (diagonalRule !== 'standard' && diagonalRule !== 'alternating') {
    fail(path + '.diagonalRule', 'must be "standard" or "alternating"');
  }

  const rawUnit = board.measurementUnit ?? DEFAULT_MEASUREMENT_UNIT;
  if (!isRecord(rawUnit)) {
    fail(path + '.measurementUnit', 'must be an object');
  }
  const label = normalizeShortString(rawUnit.label, path + '.measurementUnit.label', 16);
  const cellsValue = rawUnit.cellsValue;
  if (typeof cellsValue !== 'number' || !Number.isFinite(cellsValue) || cellsValue <= 0) {
    fail(path + '.measurementUnit.cellsValue', 'must be a positive finite number');
  }

  const rawDimensions = board.dimensions ?? { columns: 30, rows: 30 };
  if (!isRecord(rawDimensions)) fail(path + '.dimensions', 'must be an object');
  const dimensions = {};
  for (const axis of ['columns', 'rows']) {
    const dimension = rawDimensions[axis];
    if (!Number.isSafeInteger(dimension) || dimension < 0 || dimension > SCENE_LIMITS.maxBoardDimensionCells) {
      fail(path + `.dimensions.${axis}`, `must be an integer between 0 and ${SCENE_LIMITS.maxBoardDimensionCells}`);
    }
    dimensions[axis] = dimension;
  }
  if ((dimensions.columns === 0) !== (dimensions.rows === 0)) {
    fail(path + '.dimensions', 'columns and rows must both be zero or both be positive');
  }

  return {
    diagonalRule,
    measurementUnit: { label, cellsValue },
    dimensions,
    isBackgroundHidden: board.isBackgroundHidden === true,
    isFullyLit: board.isFullyLit === true,
    lightSources: normalizeLightSources(board.lightSources ?? [], path + '.lightSources'),
  };
}

function normalizeBackground(value, path) {
  const background = value === undefined ? { kind: 'blank' } : cloneJsonObject(value, path);
  if (background.kind === 'blank') return { kind: 'blank' };
  if (background.kind !== 'image') fail(path + '.kind', 'must be "blank" or "image"');

  const mediaType = background.mediaType;
  if (mediaType !== 'image/jpeg' && mediaType !== 'image/png' && mediaType !== 'image/webp') {
    fail(path + '.mediaType', 'must be image/jpeg, image/png or image/webp');
  }
  if (!Number.isSafeInteger(background.byteLength) || background.byteLength < 1) {
    fail(path + '.byteLength', 'must be a positive safe integer');
  }
  if (typeof background.etag !== 'string' || !/^[a-f0-9]{64}$/.test(background.etag)) {
    fail(path + '.etag', 'must be a SHA-256 digest');
  }
  if (typeof background.updatedAt !== 'string' || Number.isNaN(Date.parse(background.updatedAt))) {
    fail(path + '.updatedAt', 'must be an ISO date');
  }
  const scale = background.scale ?? 1;
  if (
    typeof scale !== 'number'
    || !Number.isFinite(scale)
    || scale < SCENE_LIMITS.minBackgroundScale
    || scale > SCENE_LIMITS.maxBackgroundScale
  ) {
    fail(
      path + '.scale',
      `must be between ${SCENE_LIMITS.minBackgroundScale} and ${SCENE_LIMITS.maxBackgroundScale}`,
    );
  }
  const offsets = {};
  for (const axis of ['offsetX', 'offsetY']) {
    const offset = background[axis] ?? 0;
    if (
      typeof offset !== 'number'
      || !Number.isFinite(offset)
      || Math.abs(offset) > SCENE_LIMITS.maxBackgroundOffsetPixels
    ) {
      fail(
        path + `.${axis}`,
        `must be between -${SCENE_LIMITS.maxBackgroundOffsetPixels} and ${SCENE_LIMITS.maxBackgroundOffsetPixels}`,
      );
    }
    offsets[axis] = Object.is(offset, -0) ? 0 : offset;
  }
  return {
    kind: 'image',
    assetId: normalizeId(background.assetId, path + '.assetId'),
    mediaType,
    byteLength: background.byteLength,
    etag: background.etag,
    updatedAt: background.updatedAt,
    scale,
    ...offsets,
  };
}

function normalizeDrawings(value, path) {
  return normalizeCollection(value, path, (item, itemPath) => {
    const cloned = cloneJsonObject(item, itemPath);
    if (!Array.isArray(cloned.points) || cloned.points.length === 0) {
      fail(itemPath + '.points', 'must be a non-empty array');
    }
    if (cloned.points.length > SCENE_LIMITS.maxDrawingPoints) {
      fail(
        itemPath + '.points',
        'must not contain more than ' + SCENE_LIMITS.maxDrawingPoints + ' points',
      );
    }
    const color = cloned.color ?? '#ffffff';
    if (typeof color !== 'string' || !/^#[a-fA-F0-9]{6}$/.test(color)) {
      fail(itemPath + '.color', 'must be a six-digit hex color');
    }
    const widthCells = cloned.widthCells ?? 0.12;
    if (typeof widthCells !== 'number' || !Number.isFinite(widthCells)
      || widthCells < SCENE_LIMITS.minDrawingWidthCells
      || widthCells > SCENE_LIMITS.maxDrawingWidthCells) {
      fail(itemPath + '.widthCells', 'must be a valid cell width');
    }
    return {
      id: normalizeId(cloned.id, itemPath + '.id'),
      color: color.toLowerCase(),
      widthCells,
      points: cloned.points.map((point, pointIndex) => {
        const pointPath = itemPath + '.points[' + pointIndex + ']';
        if (!isRecord(point) || !Number.isFinite(point.x) || !Number.isFinite(point.y)
          || point.x < 0 || point.y < 0
          || point.x > SCENE_LIMITS.maxCoordinateMagnitude
          || point.y > SCENE_LIMITS.maxCoordinateMagnitude) {
          fail(pointPath, 'must contain finite non-negative cell coordinates');
        }
        return { x: point.x, y: point.y };
      }),
    };
  });
}

export function normalizeSceneDrawings(value) {
  return normalizeDrawings(value, 'drawings');
}

function normalizeElements(value, path, dimensions) {
  return normalizeCollection(value, path, (item, itemPath) => {
    const cloned = cloneJsonObject(item, itemPath);
    if (!SCENE_ELEMENT_KINDS.includes(cloned.kind)) {
      fail(itemPath + '.kind', 'must be a supported scene element kind');
    }
    const position = normalizePosition(cloned.position, itemPath + '.position');
    if (position.x < 0 || position.y < 0) fail(itemPath + '.position', 'must be non-negative');
    const widthCells = cloned.widthCells ?? (cloned.kind === 'table' ? 2 : 1);
    const heightCells = cloned.heightCells ?? 1;
    for (const [axis, size] of [['widthCells', widthCells], ['heightCells', heightCells]]) {
      if (!Number.isSafeInteger(size) || size < 1 || size > SCENE_LIMITS.maxElementFootprintCells) {
        fail(itemPath + '.' + axis, `must be an integer between 1 and ${SCENE_LIMITS.maxElementFootprintCells}`);
      }
    }
    const rotation = cloned.rotation ?? 0;
    if (!Number.isSafeInteger(rotation) || rotation < 0 || rotation > 359) {
      fail(itemPath + '.rotation', 'must be an integer between 0 and 359');
    }
    const blocksMovement = cloned.blocksMovement ?? false;
    const blocksVision = cloned.blocksVision ?? false;
    if (typeof blocksMovement !== 'boolean') fail(itemPath + '.blocksMovement', 'must be a boolean');
    if (typeof blocksVision !== 'boolean') fail(itemPath + '.blocksVision', 'must be a boolean');
    if (dimensions.columns > 0
      && (position.x + widthCells > dimensions.columns || position.y + heightCells > dimensions.rows)) {
      fail(itemPath + '.position', 'must fit inside the board');
    }
    return {
      id: normalizeId(cloned.id, itemPath + '.id'),
      kind: cloned.kind,
      position,
      widthCells,
      heightCells,
      rotation,
      blocksMovement,
      blocksVision,
    };
  });
}

export function normalizeSceneElements(value, dimensions = { columns: 0, rows: 0 }) {
  return normalizeElements(value, 'elements', dimensions);
}

function normalizeEntityReferences(value, path) {
  return normalizeCollection(value, path, (item, itemPath) => {
    const cloned = cloneJsonObject(item, itemPath);
    return {
      id: normalizeId(cloned.id, itemPath + '.id'),
      entityType: normalizeShortString(
        cloned.entityType,
        itemPath + '.entityType',
        SCENE_LIMITS.maxReferenceTypeLength,
      ),
      entityId: normalizeId(cloned.entityId, itemPath + '.entityId'),
    };
  });
}

export function normalizeSceneEncounters(value) {
  return normalizeCollection(value, 'encounters', (item, itemPath) => {
    const cloned = cloneJsonObject(item, itemPath);
    if (!SCENE_ENCOUNTER_KINDS.includes(cloned.kind)) {
      fail(itemPath + '.kind', 'must be a supported encounter kind');
    }
    if (cloned.description !== undefined && (typeof cloned.description !== 'string' || cloned.description.length > 2000)) {
      fail(itemPath + '.description', 'must be a string of at most 2000 characters');
    }
    return {
      id: normalizeId(cloned.id, itemPath + '.id'),
      name: normalizeShortString(cloned.name, itemPath + '.name', SCENE_LIMITS.maxNameLength),
      kind: cloned.kind,
      description: cloned.description?.trim() ?? '',
    };
  });
}

function normalizePreparedPlacements(value, path, referenceIds, encounterIds) {
  return normalizeCollection(value, path, (item, itemPath) => {
    const cloned = cloneJsonObject(item, itemPath);
    const entityReferenceId = normalizeId(
      cloned.entityReferenceId,
      itemPath + '.entityReferenceId',
    );
    if (!referenceIds.has(entityReferenceId)) {
      fail(
        itemPath + '.entityReferenceId',
        'references missing entity "' + entityReferenceId + '"',
      );
    }
    const encounterId = cloned.encounterId === undefined
      ? undefined : normalizeId(cloned.encounterId, itemPath + '.encounterId');
    if (encounterId !== undefined && !encounterIds.has(encounterId)) {
      fail(itemPath + '.encounterId', 'references missing encounter "' + encounterId + '"');
    }
    return {
      ...cloned,
      id: normalizeId(cloned.id, itemPath + '.id'),
      entityReferenceId,
      ...(encounterId === undefined ? {} : { encounterId }),
      position: normalizePosition(cloned.position, itemPath + '.position'),
    };
  });
}

function normalizeTokens(value, path) {
  return normalizeCollection(value, path, (item, itemPath) => {
    const cloned = cloneJsonObject(item, itemPath);
    return {
      ...cloned,
      id: normalizeId(cloned.id, itemPath + '.id'),
      position: normalizePosition(cloned.position, itemPath + '.position'),
    };
  });
}

export function createDefaultSceneDocument() {
  return {
    schemaVersion: SCENE_DOCUMENT_VERSION,
    background: { kind: 'blank' },
    board: {
      diagonalRule: 'standard',
      measurementUnit: { ...DEFAULT_MEASUREMENT_UNIT },
      dimensions: { columns: 30, rows: 30 },
      isBackgroundHidden: false,
      isFullyLit: false,
      lightSources: [],
    },
    drawings: [],
    elements: [],
    encounters: [],
    entityReferences: [],
    preparedPlacements: [],
    runtime: {
      tokens: [],
    },
  };
}

export function normalizeSceneMetadata(value) {
  const metadata = cloneJsonObject(value, 'sceneMetadata');
  const version = metadata.version;
  if (!Number.isSafeInteger(version) || version < 1) {
    fail('sceneMetadata.version', 'must be a positive safe integer');
  }

  return {
    id: normalizeId(metadata.id, 'sceneMetadata.id'),
    name: normalizeShortString(
      metadata.name,
      'sceneMetadata.name',
      SCENE_LIMITS.maxNameLength,
    ),
    version,
  };
}

export function normalizeScene(value) {
  const scene = cloneJsonObject(value, 'scene');
  return {
    ...normalizeSceneMetadata(scene),
    document: normalizeSceneDocument(scene.document),
  };
}

export function normalizeSceneDocument(value) {
  if (serializedByteLength(value) > SCENE_LIMITS.maxDocumentBytes) {
    fail('scene', 'must not exceed ' + SCENE_LIMITS.maxDocumentBytes + ' serialized bytes');
  }
  if (!isRecord(value)) {
    fail('scene', 'must be an object');
  }

  const schemaVersion = value.schemaVersion ?? SCENE_DOCUMENT_VERSION;
  if (schemaVersion !== SCENE_DOCUMENT_VERSION) {
    fail('scene.schemaVersion', 'must equal ' + SCENE_DOCUMENT_VERSION);
  }

  const entityReferences = normalizeEntityReferences(
    value.entityReferences ?? [],
    'scene.entityReferences',
  );
  const referenceIds = new Set(entityReferences.map((reference) => reference.id));
  const encounters = normalizeSceneEncounters(value.encounters ?? []);
  const encounterIds = new Set(encounters.map((encounter) => encounter.id));
  const runtime = value.runtime === undefined
    ? {}
    : cloneJsonObject(value.runtime, 'scene.runtime');

  const board = normalizeBoardConfig(value.board, 'scene.board');
  const normalized = {
    schemaVersion,
    background: normalizeBackground(value.background, 'scene.background'),
    board,
    drawings: normalizeDrawings(value.drawings ?? [], 'scene.drawings'),
    elements: normalizeElements(value.elements ?? [], 'scene.elements', board.dimensions),
    encounters,
    entityReferences,
    preparedPlacements: normalizePreparedPlacements(
      value.preparedPlacements ?? [],
      'scene.preparedPlacements',
      referenceIds,
      encounterIds,
    ),
    runtime: {
      tokens: normalizeTokens(runtime.tokens ?? [], 'scene.runtime.tokens'),
    },
  };

  if (serializedByteLength(normalized) > SCENE_LIMITS.maxDocumentBytes) {
    fail('scene', 'must not exceed ' + SCENE_LIMITS.maxDocumentBytes + ' serialized bytes');
  }

  return normalized;
}

export function captureSceneConfiguration(scene) {
  const normalized = normalizeSceneDocument(scene);
  return {
    schemaVersion: normalized.schemaVersion,
    background: normalized.background,
    board: normalized.board,
    drawings: normalized.drawings,
    elements: normalized.elements,
    encounters: normalized.encounters,
    entityReferences: normalized.entityReferences,
    preparedPlacements: normalized.preparedPlacements,
  };
}

export function projectSceneRuntime(configuration, runtime = { tokens: [] }) {
  if (!isRecord(configuration)) {
    fail('configuration', 'must be an object');
  }
  return normalizeSceneDocument({
    ...configuration,
    runtime,
  });
}
