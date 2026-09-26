import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SCENE_DOCUMENT_VERSION,
  SCENE_LIMITS,
  SceneValidationError,
  captureSceneConfiguration,
  createDefaultSceneDocument,
  normalizeScene,
  normalizeSceneMetadata,
  normalizeSceneDocument,
  projectSceneRuntime,
} from '../shared/scene-model.mjs';

function validScene() {
  return {
    schemaVersion: SCENE_DOCUMENT_VERSION,
    background: { kind: 'blank' },
    board: {
      diagonalRule: 'alternating',
      measurementUnit: { label: 'ft', cellsValue: 5 },
      isBackgroundHidden: true,
      isFullyLit: false,
      lightSources: [
        { id: 'light-1', position: { x: -2, y: 3 }, radiusCells: 6 },
      ],
    },
    drawings: [
      {
        id: 'drawing-1',
        color: '#123456',
        points: [{ x: 1, y: 2 }, { x: 4, y: 5 }],
      },
    ],
    elements: [
      { id: 'element-1', kind: 'rock', position: { x: 7, y: 8 } },
    ],
    entityReferences: [
      { id: 'reference-1', entityType: 'encounter-entity', entityId: 'entity-1' },
    ],
    preparedPlacements: [
      {
        id: 'placement-1',
        entityReferenceId: 'reference-1',
        position: { x: 9, y: 10 },
      },
    ],
    runtime: {
      tokens: [
        {
          id: 'token-1',
          name: 'Guardia',
          position: { x: 11, y: 12 },
          hitPoints: 7,
        },
      ],
    },
  };
}

test('default scene contains independent, versioned, separated sections', () => {
  const first = createDefaultSceneDocument();
  const second = createDefaultSceneDocument();

  assert.equal(first.schemaVersion, 1);
  assert.deepEqual(first.background, { kind: 'blank' });
  assert.deepEqual(first.board.measurementUnit, { label: 'm', cellsValue: 1.5 });
  assert.deepEqual(first.drawings, []);
  assert.deepEqual(first.elements, []);
  assert.deepEqual(first.entityReferences, []);
  assert.deepEqual(first.preparedPlacements, []);
  assert.deepEqual(first.runtime.tokens, []);

  first.drawings.push({ id: 'local-change', points: [{ x: 0, y: 0 }] });
  first.board.measurementUnit.label = 'ft';
  assert.deepEqual(second.drawings, []);
  assert.equal(second.board.measurementUnit.label, 'm');
});

test('scene metadata supplies a stable identity and positive concurrency version', () => {
  assert.deepEqual(
    normalizeSceneMetadata({ id: ' scene-1 ', name: ' Sala del trono ', version: 3 }),
    { id: 'scene-1', name: 'Sala del trono', version: 3 },
  );

  const scene = normalizeScene({
    id: 'scene-1',
    name: 'Sala del trono',
    version: 3,
    document: {},
  });
  assert.equal(scene.id, 'scene-1');
  assert.equal(scene.version, 3);
  assert.deepEqual(scene.document, createDefaultSceneDocument());

  assert.throws(
    () => normalizeSceneMetadata({ id: '', name: 'Scena', version: 1 }),
    (error) => error instanceof SceneValidationError && error.path === 'sceneMetadata.id',
  );
  assert.throws(
    () => normalizeSceneMetadata({ id: 'scene-1', name: 'Scena', version: 0 }),
    (error) => error instanceof SceneValidationError && error.path === 'sceneMetadata.version',
  );
});

test('legacy partial scene receives canonical defaults without merging layers', () => {
  const normalized = normalizeSceneDocument({});

  assert.deepEqual(normalized, createDefaultSceneDocument());
  assert.notEqual(normalized.drawings, normalized.elements);
  assert.notEqual(normalized.elements, normalized.preparedPlacements);
  assert.notEqual(normalized.preparedPlacements, normalized.runtime.tokens);
});

test('valid data is cloned and normalized while preserving layer-specific fields', () => {
  const source = validScene();
  const normalized = normalizeSceneDocument(source);

  assert.deepEqual(normalized, source);
  assert.notEqual(normalized, source);
  assert.notEqual(normalized.runtime.tokens[0], source.runtime.tokens[0]);
  assert.equal(normalized.drawings[0].color, '#123456');
  assert.equal(normalized.elements[0].kind, 'rock');
});

test('duplicate ids are rejected within every collection', () => {
  const scene = validScene();
  scene.elements.push({ ...scene.elements[0], position: { x: 20, y: 20 } });

  assert.throws(
    () => normalizeSceneDocument(scene),
    (error) =>
      error instanceof SceneValidationError
      && error.path === 'scene.elements[1].id'
      && /duplicates id/.test(error.message),
  );
});

test('prepared placements cannot reference a missing entity', () => {
  const scene = validScene();
  scene.preparedPlacements[0].entityReferenceId = 'missing';

  assert.throws(
    () => normalizeSceneDocument(scene),
    (error) =>
      error instanceof SceneValidationError
      && error.path === 'scene.preparedPlacements[0].entityReferenceId',
  );
});

test('coordinates must be safe integers inside the configured guardrail', () => {
  const fractional = validScene();
  fractional.runtime.tokens[0].position.x = 1.5;
  assert.throws(
    () => normalizeSceneDocument(fractional),
    (error) => error instanceof SceneValidationError && error.path.endsWith('.position.x'),
  );

  const excessive = validScene();
  excessive.drawings[0].points[0].y = SCENE_LIMITS.maxCoordinateMagnitude + 1;
  assert.throws(
    () => normalizeSceneDocument(excessive),
    (error) => error instanceof SceneValidationError && error.path.endsWith('.points[0].y'),
  );
});

test('unsupported versions, invalid board values, and non-JSON input are rejected', () => {
  assert.throws(
    () => normalizeSceneDocument({ schemaVersion: 2 }),
    (error) => error instanceof SceneValidationError && error.path === 'scene.schemaVersion',
  );
  assert.throws(
    () => normalizeSceneDocument({ board: { measurementUnit: { label: 'm', cellsValue: 0 } } }),
    (error) =>
      error instanceof SceneValidationError
      && error.path === 'scene.board.measurementUnit.cellsValue',
  );

  const cyclic = {};
  cyclic.self = cyclic;
  assert.throws(
    () => normalizeSceneDocument(cyclic),
    (error) => error instanceof SceneValidationError && /JSON serializable/.test(error.message),
  );
});

test('serialized documents over the size limit are rejected before normalization', () => {
  const oversized = {
    runtime: {
      tokens: [
        {
          id: 'token-1',
          position: { x: 0, y: 0 },
          padding: 'x'.repeat(SCENE_LIMITS.maxDocumentBytes),
        },
      ],
    },
  };

  assert.throws(
    () => normalizeSceneDocument(oversized),
    (error) => error instanceof SceneValidationError && /serialized bytes/.test(error.message),
  );
});

test('capture and projection keep live runtime outside persistent configuration', () => {
  const scene = {
    ...validScene(),
    roundNumber: 4,
    initiatives: [{ tokenId: 'token-1', value: 20 }],
    diceLogs: [{ id: 'roll-1' }],
  };

  const configuration = captureSceneConfiguration(scene);
  assert.equal('runtime' in configuration, false);
  assert.equal('roundNumber' in configuration, false);
  assert.equal('initiatives' in configuration, false);
  assert.equal('diceLogs' in configuration, false);

  const projection = projectSceneRuntime(configuration, {
    tokens: [{ id: 'runtime-token', position: { x: 3, y: 4 }, hitPoints: 1 }],
  });
  assert.equal(projection.runtime.tokens[0].id, 'runtime-token');
  assert.deepEqual(configuration.preparedPlacements, scene.preparedPlacements);

  projection.drawings[0].points[0].x = 999;
  assert.equal(configuration.drawings[0].points[0].x, 1);
});
