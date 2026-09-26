import { createDefaultSceneDocument } from '../shared/scene-model.mjs';

function errorStatus(error) {
  if (Number.isInteger(error?.statusCode)) return error.statusCode;
  return error instanceof TypeError || error?.name === 'SceneValidationError' ? 400 : 500;
}

function sendError(reply, error, activeSceneId = null) {
  const statusCode = errorStatus(error);
  reply.code(statusCode);
  return {
    message: error?.message ?? 'Operazione sulle scene non riuscita.',
    ...(error?.currentScene !== undefined
      ? { currentScene: error.currentScene ? sceneDetail(error.currentScene, activeSceneId) : null }
      : {}),
  };
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

function sceneDetail(scene, activeSceneId) {
  return { ...scene, isActive: scene.id === activeSceneId };
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
    || typeof body.name !== 'string'
  ) {
    throw new TypeError('Nome e versione base della scena sono obbligatori.');
  }
  return { baseVersion: body.baseVersion, name: body.name };
}

export function registerSceneRoutes(app, { service, getUser }) {
  function masterOnly(request, reply) {
    const user = getUser(request);
    if (!user) {
      reply.code(401).send({ message: 'Autenticazione richiesta.' });
      return null;
    }
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
      return sceneDetail(scene, service.getActiveScene()?.id ?? null);
    } catch (error) {
      return sendError(reply, error, service.getActiveScene()?.id ?? null);
    }
  });

  // La lettura del dettaglio e la selezione gestionale: non cambia la scena attiva.
  app.get('/api/scenes/:id', async (request, reply) => {
    if (!masterOnly(request, reply)) return;
    const scene = service.getScene(request.params.id);
    if (!scene) return reply.code(404).send({ message: 'Scena non trovata.' });
    return sceneDetail(scene, service.getActiveScene()?.id ?? null);
  });

  app.patch('/api/scenes/:id', async (request, reply) => {
    if (!masterOnly(request, reply)) return;
    try {
      const { baseVersion, name } = validateUpdateBody(request.body);
      const current = service.getScene(request.params.id);
      if (!current) return reply.code(404).send({ message: 'Scena non trovata.' });
      const scene = service.updateScene({
        id: current.id,
        expectedVersion: baseVersion,
        name,
        document: current.document,
        sortOrder: current.sortOrder,
      });
      return sceneDetail(scene, service.getActiveScene()?.id ?? null);
    } catch (error) {
      return sendError(reply, error, service.getActiveScene()?.id ?? null);
    }
  });
}
