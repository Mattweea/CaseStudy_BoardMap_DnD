import multipart from '@fastify/multipart';
import { MAX_PORTRAIT_BYTES } from './portrait-storage.mjs';

function sendError(reply, error) {
  const status = Number.isInteger(error?.status) ? error.status : error instanceof TypeError ? 400 : 500;
  reply.code(status);
  return { message: error?.message ?? 'Errore della scheda.', ...(error?.details ?? {}) };
}

export async function registerCharacterSheetRoutes(app, { service, portraitStorage, getUser }) {
  await app.register(multipart, {
    limits: { files: 1, fileSize: MAX_PORTRAIT_BYTES, fields: 0 },
  });

  function authenticated(request, reply) {
    const user = getUser(request);
    if (!user) {
      reply.code(401).send({ message: 'Autenticazione richiesta.' });
      return null;
    }
    return user;
  }

  app.get('/api/character-sheets', async (request, reply) => {
    const user = authenticated(request, reply); if (!user) return;
    try { return { sheets: service.getRoster(user) }; } catch (error) { return sendError(reply, error); }
  });

  // Schermata di login: niente sessione ancora, quindi niente `authenticated()`. Espone solo id,
  // proprietario e URL del ritratto, mai i dati della scheda.
  app.get('/api/character-sheets/public-roster', async (request, reply) => {
    try { return { sheets: service.getPublicRoster() }; } catch (error) { return sendError(reply, error); }
  });

  app.get('/api/character-sheets/:id/public-portrait', async (request, reply) => {
    try {
      const portrait = service.getPublicPortrait(request.params.id);
      if (!portrait.portraitFileName) return reply.code(404).send({ message: 'Ritratto non disponibile.' });
      reply.type(portrait.portraitMediaType).header('Cache-Control', 'public, max-age=3600');
      return reply.send(portraitStorage.open(portrait.portraitFileName));
    } catch (error) { return sendError(reply, error); }
  });

  app.get('/api/character-sheets/:id', async (request, reply) => {
    const user = authenticated(request, reply); if (!user) return;
    try { return service.get(user, request.params.id); } catch (error) { return sendError(reply, error); }
  });

  app.patch('/api/character-sheets/:id', async (request, reply) => {
    const user = authenticated(request, reply); if (!user) return;
    try { return service.applyPatch(user, request.params.id, request.body); } catch (error) { return sendError(reply, error); }
  });

  app.post('/api/character-sheets/:id/flush', async (request, reply) => {
    const user = authenticated(request, reply); if (!user) return;
    try { return service.flush(user, request.params.id); } catch (error) { return sendError(reply, error); }
  });

  app.post('/api/character-sheets/:id/portrait', async (request, reply) => {
    const user = authenticated(request, reply); if (!user) return;
    try {
      const part = await request.file();
      if (!part) throw new TypeError('Seleziona un ritratto.');
      const buffer = await part.toBuffer();
      if (part.file.truncated) throw new TypeError('Il ritratto supera 5 MB.');
      return await service.replacePortrait(user, request.params.id, { buffer, mediaType: part.mimetype }, portraitStorage);
    } catch (error) { return sendError(reply, error); }
  });

  app.get('/api/character-sheets/:id/portrait', async (request, reply) => {
    const user = authenticated(request, reply); if (!user) return;
    try {
      const portrait = service.getPortrait(user, request.params.id);
      if (!portrait.fileName) return reply.code(404).send({ message: 'Ritratto non disponibile.' });
      reply.type(portrait.mediaType).header('Cache-Control', 'private, max-age=3600');
      return reply.send(portraitStorage.open(portrait.fileName));
    } catch (error) { return sendError(reply, error); }
  });
}
