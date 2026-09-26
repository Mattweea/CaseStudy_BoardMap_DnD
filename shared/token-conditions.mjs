// Catalogo delle condizioni PHB 5e 2014 e regole di velocità che ne derivano: unico modulo
// condiviso fra client (src/utils/tokens.ts lo riesporta con le etichette italiane) e server
// (server/index.mjs lo importa direttamente). Vedi openspec/changes/p0-8c-token-conditions/design.md,
// decisione 2.

export const CREATURE_CONDITIONS = Object.freeze([
  'blinded',
  'charmed',
  'deafened',
  'frightened',
  'grappled',
  'incapacitated',
  'invisible',
  'paralyzed',
  'petrified',
  'poisoned',
  'prone',
  'restrained',
  'stunned',
  'unconscious',
]);

export const VEHICLE_CONDITIONS = Object.freeze(['broken', 'overturned']);

const MIN_EXHAUSTION = 0;
const MAX_EXHAUSTION = 6;

// Condizioni che, secondo il PHB 2014, portano la velocità a 0 indipendentemente
// dall'Indebolimento (che vi si aggiunge dal livello 5 in su tramite `effectiveSpeed`).
export const SPEED_ZERO_CONDITIONS = Object.freeze([
  'grappled',
  'restrained',
  'paralyzed',
  'petrified',
  'stunned',
  'unconscious',
]);

const EXHAUSTION_HALVED_MIN_LEVEL = 2;
const EXHAUSTION_HALVED_MAX_LEVEL = 4;
const EXHAUSTION_SPEED_ZERO_LEVEL = 5;

// Catalogo ammesso per un tipo di token: gli oggetti non hanno condizioni.
export function conditionCatalogFor(tokenType) {
  if (tokenType === 'vehicle') {
    return VEHICLE_CONDITIONS;
  }

  if (tokenType === 'player' || tokenType === 'enemy') {
    return CREATURE_CONDITIONS;
  }

  return [];
}

export function clampExhaustionLevel(level) {
  const numericLevel = typeof level === 'number' && Number.isFinite(level) ? Math.trunc(level) : 0;
  return Math.min(MAX_EXHAUSTION, Math.max(MIN_EXHAUSTION, numericLevel));
}

// Normalizza le condizioni e il livello di Indebolimento di un token secondo il suo tipo: filtra
// col catalogo, deduplica, forza l'assenza di condizioni e Indebolimento sugli oggetti. Usata da
// entrambe le normalizzazioni di stato (server e client) per evitare una seconda copia della
// stessa regola.
export function normalizeConditionsForType(tokenType, conditions, exhaustionLevel) {
  const catalog = conditionCatalogFor(tokenType);
  const isCreature = tokenType === 'player' || tokenType === 'enemy';
  const rawConditions = Array.isArray(conditions) ? conditions : [];
  const filtered = [];
  for (const condition of rawConditions) {
    if (typeof condition === 'string' && catalog.includes(condition) && !filtered.includes(condition)) {
      filtered.push(condition);
    }
  }

  return {
    conditions: filtered,
    exhaustionLevel: isCreature ? clampExhaustionLevel(exhaustionLevel) : 0,
  };
}

// Velocità effettiva di una creatura secondo le sue condizioni e il suo Indebolimento, con
// arrotondamento per difetto. `reason` nomina la condizione (o `'exhaustion'`) che porta la
// velocità a 0 o la dimezza; `null` quando la velocità non è ridotta.
export function effectiveSpeed(movementCells, conditions = [], exhaustionLevel = 0) {
  const baseCells =
    typeof movementCells === 'number' && Number.isFinite(movementCells) && movementCells > 0
      ? movementCells
      : 0;
  const activeConditions = Array.isArray(conditions) ? conditions : [];
  const level = clampExhaustionLevel(exhaustionLevel);

  const zeroCondition = SPEED_ZERO_CONDITIONS.find((condition) => activeConditions.includes(condition));
  if (zeroCondition) {
    return { cells: 0, reason: zeroCondition };
  }

  if (level >= EXHAUSTION_SPEED_ZERO_LEVEL) {
    return { cells: 0, reason: 'exhaustion' };
  }

  if (level >= EXHAUSTION_HALVED_MIN_LEVEL && level <= EXHAUSTION_HALVED_MAX_LEVEL) {
    return { cells: Math.floor(baseCells / 2), reason: 'exhaustion' };
  }

  return { cells: baseCells, reason: null };
}

// Costo di «Alzati»: metà della velocità effettiva, arrotondata per difetto, senza contare scatto
// e movimento extra.
export function standUpCost(effectiveCells) {
  const cells = typeof effectiveCells === 'number' && Number.isFinite(effectiveCells) && effectiveCells > 0
    ? effectiveCells
    : 0;
  return Math.floor(cells / 2);
}

// Budget di movimento del round dalla velocità effettiva: 0 se la velocità è 0, così scatto e
// movimento extra non aggiungono nulla in quel caso.
export function movementBudget({ effectiveCells, dashed = false, extra = 0 }) {
  const cells = typeof effectiveCells === 'number' && Number.isFinite(effectiveCells) && effectiveCells > 0
    ? effectiveCells
    : 0;
  if (cells === 0) {
    return 0;
  }

  const extraCells = typeof extra === 'number' && Number.isFinite(extra) && extra > 0 ? extra : 0;
  return cells * (dashed ? 2 : 1) + extraCells;
}
