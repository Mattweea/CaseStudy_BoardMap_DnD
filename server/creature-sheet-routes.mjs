export function registerCreatureSheetRoutes(app, { service, getUser, portraitStorage, canViewPortrait = () => false }) {
  const master = (request) => {
    const user = getUser(request);
    if (!user || user.role !== 'master') {
      const error = new Error(user ? 'Riservato al Master.' : 'Autenticazione richiesta.');
      error.status = user ? 403 : 401;
      throw error;
    }
    return user;
  };
  const handle = (handler) => async (request, reply) => {
    try {
      return await handler(request, reply);
    } catch (error) {
      reply.code(error.status ?? (error instanceof TypeError ? 400 : 500));
      return { message: error.message };
    }
  };
  app.get(
    '/api/creature-sheets/context',
    handle((request) => service.context(master(request), request.query.sceneId, request.query.tokenId)),
  );
  app.post(
    '/api/creature-sheets/bindings',
    handle((request) => {
      const record = service.bind(master(request), request.body);
      service.changed(record);
      return record;
    }),
  );
  app.get(
    '/api/creature-sheets/bindings/:id',
    handle((request) => service.get(master(request), request.params.id)),
  );
  app.post(
    '/api/creature-sheets/bindings/:id/preview',
    handle((request) => service.preview(master(request), request.params.id, request.body)),
  );
  app.post(
    '/api/creature-sheets/bindings/:id/hit-points/preview',
    handle((request) => service.previewHitPoints(master(request), request.params.id, request.body)),
  );
  app.put(
    '/api/creature-sheets/bindings/:id',
    { bodyLimit: 8 * 1024 * 1024 },
    handle(async (request) => {
      const user = master(request),
        payload = { ...request.body };
      let staged;
      try {
        if (payload.portrait) {
          const match =
            typeof payload.portrait === 'string' &&
            payload.portrait.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
          if (!match) throw new TypeError('Ritratto non valido.');
          staged = await portraitStorage.stage(Buffer.from(match[2], 'base64'), match[1]);
          payload.portrait = staged;
        }
        const previous = service.definition(service.binding(request.params.id).sheet_id).portrait_file;
        const record = service.save(user, request.params.id, payload);
        if (
          previous &&
          !service.db.prepare('SELECT 1 FROM creature_sheet_definitions WHERE portrait_file=?').get(previous)
        )
          await portraitStorage.remove(previous);
        return record;
      } catch (error) {
        if (staged) await portraitStorage.remove(staged.fileName);
        throw error;
      }
    }),
  );
  app.delete(
    '/api/creature-sheets/bindings/:id',
    handle((request) => {
      master(request);
      service.binding(request.params.id);
      service.db.prepare('DELETE FROM creature_sheet_bindings WHERE id=?').run(request.params.id);
      service.project();
      return { ok: true };
    }),
  );
  app.delete(
    '/api/creature-sheets/:id',
    handle((request) => {
      master(request);
      service.definition(request.params.id);
      if (service.targets(request.params.id).length) {
        const error = new Error('Scollega prima tutte le creature.');
        error.status = 409;
        throw error;
      }
      service.db.prepare('DELETE FROM creature_sheet_definitions WHERE id=?').run(request.params.id);
      return { ok: true };
    }),
  );
  app.get(
    '/api/creature-sheets/:id/portrait',
    handle((request, reply) => {
      const user = getUser(request);
      if (!user) {
        const error = new Error('Autenticazione richiesta.');
        error.status = 401;
        throw error;
      }
      if (user.role !== 'master' && !canViewPortrait(user, request.params.id)) {
        const error = new Error('Ritratto non disponibile.');
        error.status = 403;
        throw error;
      }
      const sheet = service.definition(request.params.id);
      if (!sheet.portrait_file) return reply.code(404).send({ message: 'Ritratto non disponibile.' });
      reply.type(sheet.portrait_type).header('Cache-Control', 'private, no-store');
      return reply.send(portraitStorage.open(sheet.portrait_file));
    }),
  );
}
