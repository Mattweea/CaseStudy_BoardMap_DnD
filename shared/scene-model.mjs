export const SCENE_DOCUMENT_VERSION = 1;

export const SCENE_LIMITS = Object.freeze({
  maxDocumentBytes: 2 * 1024 * 1024,
  maxIdLength: 128,
  maxNameLength: 120,
  maxReferenceTypeLength: 64,
  maxLayerItems: 5000,
  maxDrawingPoints: 20000,
  maxCoordinateMagnitude: 1_000_000,
  maxLightRadiusCells: 1000,
});

const DEFAULT_MEASUREMENT_UNIT = Object.freeze({
  label: 'm',
  cellsValue: 1.5,
});

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

  return {
    diagonalRule,
    measurementUnit: { label, cellsValue },
    isBackgroundHidden: board.isBackgroundHidden === true,
    isFullyLit: board.isFullyLit === true,
    lightSources: normalizeLightSources(board.lightSources ?? [], path + '.lightSources'),
  };
}

function normalizeBackground(value, path) {
  const background = value === undefined ? { kind: 'blank' } : cloneJsonObject(value, path);
  if (background.kind !== 'blank') {
    fail(path + '.kind', 'must be "blank" until a background asset capability is applied');
  }
  return { kind: 'blank' };
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
    return {
      ...cloned,
      id: normalizeId(cloned.id, itemPath + '.id'),
      points: cloned.points.map((point, pointIndex) =>
        normalizePosition(point, itemPath + '.points[' + pointIndex + ']')),
    };
  });
}

function normalizeElements(value, path) {
  return normalizeCollection(value, path, (item, itemPath) => {
    const cloned = cloneJsonObject(item, itemPath);
    return {
      ...cloned,
      id: normalizeId(cloned.id, itemPath + '.id'),
      position: normalizePosition(cloned.position, itemPath + '.position'),
    };
  });
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

function normalizePreparedPlacements(value, path, referenceIds) {
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
    return {
      ...cloned,
      id: normalizeId(cloned.id, itemPath + '.id'),
      entityReferenceId,
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
      isBackgroundHidden: false,
      isFullyLit: false,
      lightSources: [],
    },
    drawings: [],
    elements: [],
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
  const runtime = value.runtime === undefined
    ? {}
    : cloneJsonObject(value.runtime, 'scene.runtime');

  const normalized = {
    schemaVersion,
    background: normalizeBackground(value.background, 'scene.background'),
    board: normalizeBoardConfig(value.board, 'scene.board'),
    drawings: normalizeDrawings(value.drawings ?? [], 'scene.drawings'),
    elements: normalizeElements(value.elements ?? [], 'scene.elements'),
    entityReferences,
    preparedPlacements: normalizePreparedPlacements(
      value.preparedPlacements ?? [],
      'scene.preparedPlacements',
      referenceIds,
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
