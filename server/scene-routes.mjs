import { createDefaultSceneDocument } from '../shared/scene-model.mjs';
import { MAX_SCENE_BACKGROUND_BYTES } from './scene-background-storage.mjs';

function errorStatus(error) {
  if (Number.isInteger(error?.statusCode)) return error.statusCode;
  return error instanceof TypeError || error?.name === 'SceneValidationError' ? 400 : 500;
}

function catalogEntry(scene, activeSceneId) {
  return {
    id: scene.id,
    name: scene.name,
    version: scene.version,
    sortOrder: scene.sortOrder,
    createdAt: scene.createdAt,
    updatedAt: scene.updatedAt,
    isActive: scene.id === activeSceneId,
  };
}

function validateCreateBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || typeof body.name !== 'string') {
    throw new TypeError('Inserisci un nome valido per la scena.');
  }
  return { name: body.name };
}

function validateUpdateBody(body) {
  if (
    !body
    || typeof body !== 'object'
    || Array.isArray(body)
    || !Number.isSafeInteger(body.baseVersion)
    || body.baseVersion < 1
    || (body.name === undefined && body.backgroundCalibration === undefined && body.boardDimensions === undefined)
    || (body.name !== undefined && typeof body.name !== 'string')
    || (
      body.backgroundCalibration !== undefined
      && (
        !body.backgroundCalibration
        || typeof body.backgroundCalibration !== 'object'
        || Array.isArray(body.backgroundCalibration)
        || typeof body.backgroundCalibration.scale !== 'number'
        || typeof body.backgroundCalibration.offsetX !== 'number'
        || typeof body.backgroundCalibration.offsetY !== 'number'
      )
    )
    || (
      body.boardDimensions !== undefined
      && (
        !body.boardDimensions
        || typeof body.boardDimensions !== 'object'
        || Array.isArray(body.boardDimensions)
        || !Number.isSafeInteger(body.boardDimensions.columns)
        || body.boardDimensions.columns < 0
        || body.boardDimensions.columns > 500
        || !Number.isSafeInteger(body.boardDimensions.rows)
        || body.boardDimensions.rows < 0
        || body.boardDimensions.rows > 500
        || ((body.boardDimensions.columns === 0) !== (body.boardDimensions.rows === 0))
      )
    )
  ) {
    throw new TypeError('Modifica e versione base della scena sono obbligatorie.');
  }
  return {
    baseVersion: body.baseVersion,
    name: body.name,
    backgroundCalibration: body.backgroundCalibration,
    boardDimensions: body.boardDimensions,
  };
}

export function registerSceneRoutes(app, {
  service,
  getUser,
  backgroundStorage = null,
  onActiveSceneUpdated = null,
  getRuntimeTokens = () => [],
}) {
  function sceneDetail(scene) {
    return {
      ...scene,
      isActive: scene.id === service.getActiveScene()?.id,
      drawingHistory: service.getDrawingHistoryState(scene.id),
    };
  }

  function sendError(reply, error) {
    reply.code(errorStatus(error));
    return {
      message: error?.message ?? 'Operazione sulle scene non riuscita.',
      ...(error?.currentScene !== undefined
        ? { currentScene: error.currentScene ? sceneDetail(error.currentScene) : null }
        : {}),
    };
  }

  function authenticated(request, reply) {
    const user = getUser(request);
    if (!user) {
      reply.code(401).send({ message: 'Autenticazione richiesta.' });
      return null;
    }
    return user;
  }

  function masterOnly(request, reply) {
    const user = authenticated(request, reply);
    if (!user) return null;
    if (user.role !== 'master') {
      reply.code(403).send({ message: 'Il catalogo scene e riservato al Master.' });
      return null;
    }
    return user;
  }

  app.get('/api/scenes', async (request, reply) => {
    if (!masterOnly(request, reply)) return;
    const activeSceneId = service.getActiveScene()?.id ?? null;
    return { scenes: service.getCatalog().map((scene) => catalogEntry(scene, activeSceneId)) };
  });

  app.post('/api/scenes', async (request, reply) => {
    if (!masterOnly(request, reply)) return;
    try {
      const { name } = validateCreateBody(request.body);
      const catalog = service.getCatalog();
      const sortOrder = catalog.reduce((maximum, scene) => Math.max(maximum, scene.sortOrder), -1) + 1;
      const scene = service.createScene({ name, sortOrder, document: createDefaultSceneDocument() });
      reply.code(201);
      return sceneDetail(scene);
    } catch (error) {
      return sendError(reply, error);
    }
  });

  // La lettura del dettaglio e la selezione gestionale: non cambia la scena attiva.
  app.get('/api/scenes/:id', async (request, reply) => {
    if (!masterOnly(request, reply)) return;
    const scene = service.getScene(request.params.id);
    if (!scene) return reply.code(404).send({ message: 'Scena non trovata.' });
    return sceneDetail(scene);
  });

  app.patch('/api/scenes/:id', async (request, reply) => {
    if (!masterOnly(request, reply)) return;
    try {
      const { baseVersion, name, backgroundCalibration, boardDimensions } = validateUpdateBody(request.body);
      const current = service.getScene(request.params.id);
      if (!current) return reply.code(404).send({ message: 'Scena non trovata.' });
      if (backgroundCalibration !== undefined && current.document.background.kind !== 'image') {
        throw new TypeError('La calibrazione richiede uno sfondo immagine.');
      }
      if (boardDimensions !== undefined && current.id === service.getActiveScene()?.id
        && boardDimensions.columns > 0) {
        const excludesToken = getRuntimeTokens().some((token) => {
          const width = typeof token.widthCells === 'number' && token.widthCells > 0
            ? Math.max(1, Math.floor(token.widthCells))
            : ({ tiny: 1, small: 1, medium: 1, large: 2, huge: 3, gargantuan: 4 }[token.size] ?? 1);
          const height = typeof token.heightCells === 'number' && token.heightCells > 0
            ? Math.max(1, Math.floor(token.heightCells))
            : ({ tiny: 1, small: 1, medium: 1, large: 2, huge: 3, gargantuan: 4 }[token.size] ?? 1);
          return token.position.x < 0 || token.position.y < 0
            || token.position.x + width > boardDimensions.columns
            || token.position.y + height > boardDimensions.rows;
        });
        if (excludesToken) throw new TypeError('La griglia non può escludere token già presenti.');
      }
      const document = {
        ...current.document,
        ...(backgroundCalibration === undefined ? {} : {
          background: { ...current.document.background, ...backgroundCalibration },
        }),
        ...(boardDimensions === undefined ? {} : {
          board: { ...current.document.board, dimensions: boardDimensions },
        }),
      };
      const scene = service.updateScene({
        id: current.id,
        expectedVersion: baseVersion,
        name: name ?? current.name,
        document,
        sortOrder: current.sortOrder,
      });
      if (scene.id === service.getActiveScene()?.id) {
        onActiveSceneUpdated?.(scene);
      }
      return sceneDetail(scene);
    } catch (error) {
      return sendError(reply, error);
    }
  });

  async function mutateDrawings(request, reply, mode) {
    if (!masterOnly(request, reply)) return;
    try {
      const body = request.body;
      if (!body || typeof body !== 'object' || Array.isArray(body)
        || !Number.isSafeInteger(body.baseVersion) || body.baseVersion < 1) {
        throw new TypeError('La versione base della scena e obbligatoria.');
      }
      const scene = mode === 'add'
        ? service.addDrawing({ id: request.params.id, expectedVersion: body.baseVersion, drawing: body.drawing })
        : service.eraseDrawings({ id: request.params.id, expectedVersion: body.baseVersion, ids: body.ids });
      if (scene.id === service.getActiveScene()?.id) onActiveSceneUpdated?.(scene);
      return sceneDetail(scene);
    } catch (error) {
      return sendError(reply, error);
    }
  }

  app.post('/api/scenes/:id/drawings', (request, reply) => mutateDrawings(request, reply, 'add'));
  app.delete('/api/scenes/:id/drawings', (request, reply) => mutateDrawings(request, reply, 'erase'));

  async function replayDrawing(request, reply, direction) {
    if (!masterOnly(request, reply)) return;
    try {
      const body = request.body;
      if (!body || typeof body !== 'object' || Array.isArray(body)
        || !Number.isSafeInteger(body.baseVersion) || body.baseVersion < 1) {
        throw new TypeError('La versione base della scena e obbligatoria.');
      }
      const scene = service.replayDrawing({ id: request.params.id, expectedVersion: body.baseVersion, direction });
      if (scene.id === service.getActiveScene()?.id) onActiveSceneUpdated?.(scene);
      return sceneDetail(scene);
    } catch (error) {
      return sendError(reply, error);
    }
  }

  app.post('/api/scenes/:id/drawings/undo', (request, reply) => replayDrawing(request, reply, 'undo'));
  app.post('/api/scenes/:id/drawings/redo', (request, reply) => replayDrawing(request, reply, 'redo'));

  function mutateElement(request, reply, mode) {
    if (!masterOnly(request, reply)) return;
    try {
      const body = request.body;
      if (!body || typeof body !== 'object' || Array.isArray(body)
        || !Number.isSafeInteger(body.baseVersion) || body.baseVersion < 1) {
        throw new TypeError('La versione base della scena è obbligatoria.');
      }
      const args = { id: request.params.id, expectedVersion: body.baseVersion };
      const scene = mode === 'add'
        ? service.addElement({ ...args, element: body.element })
        : mode === 'update'
          ? service.updateElement({ ...args, elementId: request.params.elementId, transform: body.transform })
          : service.removeElement({ ...args, elementId: request.params.elementId });
      if (scene.id === service.getActiveScene()?.id) onActiveSceneUpdated?.(scene);
      return sceneDetail(scene);
    } catch (error) {
      return sendError(reply, error);
    }
  }

  app.post('/api/scenes/:id/elements', (request, reply) => mutateElement(request, reply, 'add'));
  app.patch('/api/scenes/:id/elements/:elementId', (request, reply) => mutateElement(request, reply, 'update'));
  app.delete('/api/scenes/:id/elements/:elementId', (request, reply) => mutateElement(request, reply, 'remove'));

  if (backgroundStorage) {
    app.addContentTypeParser(
      ['image/jpeg', 'image/png', 'image/webp'],
      { parseAs: 'buffer', bodyLimit: MAX_SCENE_BACKGROUND_BYTES },
      (_request, body, done) => done(null, body),
    );

    app.put('/api/scenes/:id/background', async (request, reply) => {
      if (!masterOnly(request, reply)) return;
      try {
        const baseVersion = Number(request.headers['x-scene-base-version']);
        if (!Number.isSafeInteger(baseVersion) || baseVersion < 1) {
          throw new TypeError('La versione base della scena e obbligatoria.');
        }
        const scene = await service.replaceBackground({
          id: request.params.id,
          expectedVersion: baseVersion,
          buffer: request.body,
          mediaType: request.headers['content-type'],
          storage: backgroundStorage,
        });
        if (scene.id === service.getActiveScene()?.id) onActiveSceneUpdated?.(scene);
        return sceneDetail(scene);
      } catch (error) {
        return sendError(reply, error);
      }
    });

    app.delete('/api/scenes/:id/background', async (request, reply) => {
      if (!masterOnly(request, reply)) return;
      try {
        const baseVersion = Number(request.headers['x-scene-base-version']);
        if (!Number.isSafeInteger(baseVersion) || baseVersion < 1) {
          throw new TypeError('La versione base della scena e obbligatoria.');
        }
        const scene = await service.clearBackground({
          id: request.params.id,
          expectedVersion: baseVersion,
          storage: backgroundStorage,
        });
        if (scene.id === service.getActiveScene()?.id) onActiveSceneUpdated?.(scene);
        return sceneDetail(scene);
      } catch (error) {
        return sendError(reply, error);
      }
    });

    app.get('/api/scenes/:id/background', async (request, reply) => {
      const user = authenticated(request, reply);
      if (!user) return;
      try {
        const scene = service.getScene(request.params.id);
        if (!scene) return reply.code(404).send({ message: 'Scena non trovata.' });
        if (user.role !== 'master' && service.getActiveScene()?.id !== scene.id) {
          return reply.code(403).send({ message: 'Sfondo scena non accessibile.' });
        }
        const background = scene.document.background;
        if (background.kind !== 'image') return reply.code(404).send({ message: 'Sfondo non disponibile.' });
        const etag = `"${background.etag}"`;
        reply.header('ETag', etag).header('Cache-Control', 'private, max-age=3600').type(background.mediaType);
        if (request.headers['if-none-match'] === etag) return reply.code(304).send();
        return reply.send(backgroundStorage.open(background));
      } catch (error) {
        return sendError(reply, error);
      }
    });
  }
}
