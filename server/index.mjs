import Fastify from 'fastify';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const app = Fastify({
  logger: true,
});

const PORT = Number(process.env.PORT ?? 3001);
const HOST = process.env.HOST ?? '0.0.0.0';
const SESSION_COOKIE = 'battle_map_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;
const PASSWORD_SALT = process.env.AUTH_PASSWORD_SALT ?? 'board-map-demo-salt';

const DEFAULT_TOKEN_COLORS = {
  player: '#2f9e44',
  enemy: '#c92a2a',
  object: '#e67700',
  vehicle: '#495057',
};

const VEHICLE_PRESETS = {
  'infernal-bike': { size: 'large' },
  tormentor: { size: 'huge' },
  'demon-grinder': { size: 'gargantuan' },
};

const demoUsers = [
  {
    id: 'master-demo',
    username: 'master',
    password: 'master123',
    displayName: 'Dungeon Master',
    role: 'master',
  },
  {
    id: 'adventurer-aria',
    username: 'aria',
    password: 'adventurer123',
    displayName: 'Aria',
    role: 'adventurer',
  },
  {
    id: 'adventurer-borin',
    username: 'borin',
    password: 'adventurer123',
    displayName: 'Borin',
    role: 'adventurer',
  },
];

const initialSharedState = {
  tokens: [
    {
      id: 'sample-player-1',
      name: 'Aria',
      type: 'player',
      size: 'medium',
      position: { x: 4, y: 4 },
      color: DEFAULT_TOKEN_COLORS.player,
      initiativeModifier: 0,
      affiliation: 'player',
      vehicleKind: null,
      showVehicleOccupants: undefined,
      conditions: [],
    },
    {
      id: 'sample-player-2',
      name: 'Borin',
      type: 'player',
      size: 'medium',
      position: { x: 6, y: 5 },
      color: DEFAULT_TOKEN_COLORS.player,
      initiativeModifier: 0,
      affiliation: 'player',
      vehicleKind: null,
      showVehicleOccupants: undefined,
      conditions: [],
    },
    {
      id: 'sample-enemy-1',
      name: 'Goblin A',
      type: 'enemy',
      size: 'small',
      position: { x: 14, y: 10 },
      color: DEFAULT_TOKEN_COLORS.enemy,
      initiativeModifier: 0,
      affiliation: 'enemy',
      vehicleKind: null,
      showVehicleOccupants: undefined,
      conditions: [],
    },
    {
      id: 'sample-enemy-2',
      name: 'Goblin B',
      type: 'enemy',
      size: 'small',
      position: { x: 16, y: 11 },
      color: DEFAULT_TOKEN_COLORS.enemy,
      initiativeModifier: 0,
      affiliation: 'enemy',
      vehicleKind: null,
      showVehicleOccupants: undefined,
      conditions: [],
    },
  ],
  diceLogs: [],
  initiatives: [],
  activeTurnTokenId: null,
};

let battleMapState = normalizeSharedState(initialSharedState);
let battleMapVersion = 1;
const streamClients = new Set();

function defaultVehicleColor(side) {
  return side === 'enemy' ? '#7f1d1d' : '#374151';
}

function normalizeVehicleLinks(tokens) {
  const clonedTokens = tokens.map((token) => ({
    ...token,
    vehicleOccupantIds: token.type === 'vehicle' ? [...(token.vehicleOccupantIds ?? [])] : [],
    showVehicleOccupants: token.type === 'vehicle' ? token.showVehicleOccupants ?? true : undefined,
    containedInVehicleId: token.containedInVehicleId ?? null,
  }));
  const tokenMap = new Map(clonedTokens.map((token) => [token.id, token]));

  clonedTokens.forEach((token) => {
    token.containedInVehicleId = null;
  });

  clonedTokens.forEach((token) => {
    if (token.type !== 'vehicle') {
      token.vehicleOccupantIds = [];
      return;
    }

    const dedupedOccupants = [];
    const seen = new Set();

    (token.vehicleOccupantIds ?? []).forEach((occupantId) => {
      if (seen.has(occupantId)) {
        return;
      }

      const occupant = tokenMap.get(occupantId);
      if (!occupant || occupant.id === token.id || occupant.type === 'object' || occupant.type === 'vehicle') {
        return;
      }

      seen.add(occupantId);
      dedupedOccupants.push(occupantId);
      occupant.containedInVehicleId = token.id;
      occupant.position = { ...token.position };
    });

    token.vehicleOccupantIds = dedupedOccupants;
  });

  return clonedTokens;
}

function applyVehicleAwareUpdates(tokens) {
  const normalized = normalizeVehicleLinks(tokens);
  const vehicleMap = new Map(
    normalized
      .filter((token) => token.type === 'vehicle')
      .map((token) => [token.id, token]),
  );

  return normalized.map((token) => {
    if (!token.containedInVehicleId) {
      return token;
    }

    const vehicle = vehicleMap.get(token.containedInVehicleId);
    if (!vehicle) {
      return {
        ...token,
        containedInVehicleId: null,
      };
    }

    return {
      ...token,
      position: { ...vehicle.position },
    };
  });
}

function normalizeSharedState(parsed) {
  const tokens = Array.isArray(parsed?.tokens)
    ? parsed.tokens.map((token) => {
        const type = token.type ?? 'object';
        const affiliation =
          token.affiliation ??
          (type === 'enemy' ? 'enemy' : type === 'player' ? 'player' : null);
        const fallbackColor =
          type === 'vehicle'
            ? defaultVehicleColor(affiliation === 'enemy' ? 'enemy' : 'player')
            : DEFAULT_TOKEN_COLORS[type];

        return {
          ...token,
          type,
          size: token.size ?? (token.vehicleKind ? VEHICLE_PRESETS[token.vehicleKind].size : 'medium'),
          color: token.color ?? fallbackColor,
          initiativeModifier:
            typeof token.initiativeModifier === 'number' ? token.initiativeModifier : 0,
          affiliation,
          vehicleKind: token.vehicleKind ?? null,
          vehicleOccupantIds: Array.isArray(token.vehicleOccupantIds) ? token.vehicleOccupantIds : [],
          showVehicleOccupants:
            type === 'vehicle'
              ? typeof token.showVehicleOccupants === 'boolean'
                ? token.showVehicleOccupants
                : true
              : undefined,
          containedInVehicleId:
            typeof token.containedInVehicleId === 'string' ? token.containedInVehicleId : null,
          conditions: Array.isArray(token.conditions) ? token.conditions : [],
        };
      })
    : initialSharedState.tokens;
  const initiatives = Array.isArray(parsed?.initiatives)
    ? parsed.initiatives.filter((entry) => tokens.some((token) => token.id === entry.tokenId))
    : [];

  return {
    tokens: applyVehicleAwareUpdates(tokens),
    diceLogs: Array.isArray(parsed?.diceLogs)
      ? parsed.diceLogs.map((log) => ({
          ...log,
          formula: log.formula ?? log.label,
        }))
      : [],
    initiatives,
    activeTurnTokenId:
      typeof parsed?.activeTurnTokenId === 'string' ? parsed.activeTurnTokenId : null,
  };
}

function nextSnapshot() {
  return {
    state: battleMapState,
    version: battleMapVersion,
  };
}

function bumpBattleMapVersion() {
  battleMapVersion += 1;
}

function broadcastSnapshot() {
  const payload = `data: ${JSON.stringify(nextSnapshot())}\n\n`;

  streamClients.forEach((client) => {
    try {
      client.write(payload);
    } catch (error) {
      streamClients.delete(client);
    }
  });
}

function replaceBattleMapState(nextState) {
  battleMapState = normalizeSharedState(nextState);
  bumpBattleMapVersion();
  broadcastSnapshot();
  return nextSnapshot();
}

function appendDiceLog(log) {
  battleMapState = {
    ...battleMapState,
    diceLogs: [log, ...battleMapState.diceLogs].slice(0, 30),
  };
  bumpBattleMapVersion();
  broadcastSnapshot();
  return nextSnapshot();
}

function clearBattleMapDiceLogs() {
  battleMapState = {
    ...battleMapState,
    diceLogs: [],
  };
  bumpBattleMapVersion();
  broadcastSnapshot();
  return nextSnapshot();
}

function hashPassword(password) {
  return scryptSync(password, PASSWORD_SALT, 64);
}

function normalizeUsers(rawUsers) {
  return rawUsers.map((user) => ({
    id: user.id,
    username: String(user.username).trim().toLowerCase(),
    displayName: user.displayName,
    role: user.role === 'master' ? 'master' : 'adventurer',
    passwordHash: hashPassword(String(user.password)),
  }));
}

function loadUsers() {
  if (!process.env.AUTH_USERS_JSON) {
    return normalizeUsers(demoUsers);
  }

  try {
    const parsed = JSON.parse(process.env.AUTH_USERS_JSON);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('AUTH_USERS_JSON must be a non-empty array');
    }

    return normalizeUsers(parsed);
  } catch (error) {
    app.log.error(error, 'Invalid AUTH_USERS_JSON. Falling back to demo users.');
    return normalizeUsers(demoUsers);
  }
}

const users = loadUsers();
const userMap = new Map(users.map((user) => [user.id, user]));
const sessionStore = new Map();

function parseCookies(headerValue) {
  if (!headerValue) {
    return {};
  }

  return headerValue.split(';').reduce((cookies, chunk) => {
    const [rawName, ...rawValueParts] = chunk.trim().split('=');
    if (!rawName) {
      return cookies;
    }

    cookies[rawName] = decodeURIComponent(rawValueParts.join('='));
    return cookies;
  }, {});
}

function serializeCookie(name, value, options = {}) {
  const segments = [`${name}=${encodeURIComponent(value)}`];

  if (options.maxAge !== undefined) {
    segments.push(`Max-Age=${options.maxAge}`);
  }

  segments.push(`Path=${options.path ?? '/'}`);
  segments.push(`SameSite=${options.sameSite ?? 'Lax'}`);

  if (options.httpOnly !== false) {
    segments.push('HttpOnly');
  }

  if (options.secure) {
    segments.push('Secure');
  }

  return segments.join('; ');
}

function sanitizeUser(user) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
  };
}

function clearExpiredSessions() {
  const now = Date.now();

  sessionStore.forEach((session, sessionId) => {
    if (session.expiresAt <= now) {
      sessionStore.delete(sessionId);
    }
  });
}

function getSessionUser(request) {
  clearExpiredSessions();
  const cookies = parseCookies(request.headers.cookie);
  const sessionId = cookies[SESSION_COOKIE];
  if (!sessionId) {
    return null;
  }

  const session = sessionStore.get(sessionId);
  if (!session || session.expiresAt <= Date.now()) {
    sessionStore.delete(sessionId);
    return null;
  }

  const user = userMap.get(session.userId);
  return user ? sanitizeUser(user) : null;
}

function requireUser(request, reply) {
  const user = getSessionUser(request);
  if (!user) {
    reply.code(401);
    reply.send({ message: 'Sessione non valida.' });
    return null;
  }

  return user;
}

function requireMaster(request, reply) {
  const user = requireUser(request, reply);
  if (!user) {
    return null;
  }

  if (user.role !== 'master') {
    reply.code(403);
    reply.send({ message: 'Solo il master puo modificare la battle map.' });
    return null;
  }

  return user;
}

function setSessionCookie(reply, sessionId) {
  reply.header(
    'Set-Cookie',
    serializeCookie(SESSION_COOKIE, sessionId, {
      httpOnly: true,
      maxAge: Math.floor(SESSION_TTL_MS / 1000),
      path: '/',
      sameSite: 'Lax',
      secure: process.env.NODE_ENV === 'production',
    }),
  );
}

function clearSessionCookie(reply) {
  reply.header(
    'Set-Cookie',
    serializeCookie(SESSION_COOKIE, '', {
      httpOnly: true,
      maxAge: 0,
      path: '/',
      sameSite: 'Lax',
      secure: process.env.NODE_ENV === 'production',
    }),
  );
}

function isAllowedOrigin(origin) {
  if (!origin) {
    return false;
  }

  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/u.test(origin)) {
    return true;
  }

  const configuredOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  return configuredOrigins.includes(origin);
}

app.addHook('onRequest', async (request, reply) => {
  const origin = request.headers.origin;

  if (isAllowedOrigin(origin)) {
    reply.header('Access-Control-Allow-Origin', origin);
    reply.header('Access-Control-Allow-Credentials', 'true');
    reply.header('Access-Control-Allow-Headers', 'Content-Type');
    reply.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    reply.header('Vary', 'Origin');
  }

  if (request.method === 'OPTIONS') {
    return reply.code(204).send();
  }
});

app.get('/api/health', async () => ({
  ok: true,
  users: users.length,
  version: battleMapVersion,
}));

app.get('/api/auth/session', async (request) => ({
  user: getSessionUser(request),
}));

app.post('/api/auth/login', async (request, reply) => {
  const body = request.body ?? {};
  const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!username || !password) {
    reply.code(400);
    return { message: 'Inserisci username e password.' };
  }

  const user = users.find((candidate) => candidate.username === username);
  if (!user) {
    reply.code(401);
    return { message: 'Credenziali non valide.' };
  }

  const providedHash = hashPassword(password);
  if (!timingSafeEqual(providedHash, user.passwordHash)) {
    reply.code(401);
    return { message: 'Credenziali non valide.' };
  }

  const sessionId = randomBytes(24).toString('hex');
  sessionStore.set(sessionId, {
    userId: user.id,
    expiresAt: Date.now() + SESSION_TTL_MS,
  });
  setSessionCookie(reply, sessionId);

  return {
    user: sanitizeUser(user),
  };
});

app.post('/api/auth/logout', async (request, reply) => {
  const cookies = parseCookies(request.headers.cookie);
  const sessionId = cookies[SESSION_COOKIE];
  if (sessionId) {
    sessionStore.delete(sessionId);
  }

  clearSessionCookie(reply);
  return { ok: true };
});

app.get('/api/battle-map/state', async (request, reply) => {
  const user = requireUser(request, reply);
  if (!user) {
    return;
  }

  return nextSnapshot();
});

app.put('/api/battle-map/state', async (request, reply) => {
  const user = requireMaster(request, reply);
  if (!user) {
    return;
  }

  const body = request.body ?? {};
  const nextState = normalizeSharedState(body.state);
  const baseVersion = typeof body.baseVersion === 'number' ? body.baseVersion : null;

  if (baseVersion !== null && baseVersion !== battleMapVersion) {
    reply.code(409);
    return {
      message: 'Lo stato condiviso e cambiato. Sincronizza e riprova.',
      ...nextSnapshot(),
    };
  }

  return replaceBattleMapState(nextState);
});

app.post('/api/battle-map/dice-logs', async (request, reply) => {
  const user = requireUser(request, reply);
  if (!user) {
    return;
  }

  const body = request.body ?? {};
  if (!body.log || typeof body.log !== 'object') {
    reply.code(400);
    return { message: 'Payload log non valido.' };
  }

  return appendDiceLog(body.log);
});

app.delete('/api/battle-map/dice-logs', async (request, reply) => {
  const user = requireUser(request, reply);
  if (!user) {
    return;
  }

  return clearBattleMapDiceLogs();
});

app.get('/api/battle-map/stream', async (request, reply) => {
  const user = requireUser(request, reply);
  if (!user) {
    return;
  }

  // SSE keeps every authenticated client aligned with the latest server snapshot.
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  });
  reply.hijack();

  const client = {
    write: (payload) => reply.raw.write(payload),
  };
  streamClients.add(client);
  client.write(`data: ${JSON.stringify(nextSnapshot())}\n\n`);

  const keepAliveId = setInterval(() => {
    client.write(': keepalive\n\n');
  }, 25000);

  request.raw.on('close', () => {
    clearInterval(keepAliveId);
    streamClients.delete(client);
  });
});

app.listen({ port: PORT, host: HOST }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
