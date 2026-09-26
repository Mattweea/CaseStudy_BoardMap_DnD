// Aure proiettate dalla scheda sul token canonico di un personaggio: palette, limiti, area
// secondo la griglia del PHB e presenza. Unico modulo condiviso fra client e server, sul modello
// di shared/token-conditions.mjs. Vedi openspec/changes/p0-8d-token-auras/design.md, decisione 2.

// Palette chiusa di otto colori leggibili sulla mappa scura, sia come riempimento a bassa
// opacità sia come bordo pieno.
export const AURA_COLORS = Object.freeze([
  '#3ba7ff',
  '#33c98f',
  '#f4c430',
  '#ff8a3d',
  '#ff5c8a',
  '#b06bff',
  '#4fd6d6',
  '#ff4d4d',
]);

export const AURA_LIMITS = Object.freeze({
  maxAuras: 10,
  minRadiusCells: 1,
  maxRadiusCells: 24,
  maxNameLength: 60,
  maxEffectLength: 500,
});

// Id stabile dell'utente Master nel roster canonico (server/characters.mjs, src/constants/characters.ts).
// Duplicato qui come letterale perché questo modulo, come dnd-rules.mjs, non ha dipendenze.
const MASTER_USER_ID = 'master-user';

function tokenSizeCells(size) {
  switch (size) {
    case 'large':
      return 2;
    case 'huge':
      return 3;
    case 'gargantuan':
      return 4;
    case 'tiny':
    case 'small':
    case 'medium':
    default:
      return 1;
  }
}

// Stesso calcolo dell'ingombro usato dalla mappa (server/index.mjs, src/utils/tokens.ts,
// src/utils/board.ts): dimensioni esplicite quando positive, altrimenti la taglia D&D.
function tokenFootprint(token) {
  const width =
    typeof token?.widthCells === 'number' && token.widthCells > 0
      ? Math.max(1, Math.floor(token.widthCells))
      : tokenSizeCells(token?.size);
  const height =
    typeof token?.heightCells === 'number' && token.heightCells > 0
      ? Math.max(1, Math.floor(token.heightCells))
      : tokenSizeCells(token?.size);
  return { width, height };
}

function rectanglesIntersect(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function parseRadiusCells(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.floor(value);
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return Number.parseInt(value, 10);
  return AURA_LIMITS.minRadiusCells;
}

function clampRadiusCells(value) {
  return Math.min(AURA_LIMITS.maxRadiusCells, Math.max(AURA_LIMITS.minRadiusCells, value));
}

// Raggio in caselle da un valore nell'unità di misura della partita: arrotondato alla casella
// più vicina, minimo una casella, massimo AURA_LIMITS.maxRadiusCells.
export function radiusCellsFromUnit(value, cellsValue) {
  const numericValue = typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
  const numericCellsValue =
    typeof cellsValue === 'number' && Number.isFinite(cellsValue) && cellsValue > 0 ? cellsValue : 1;
  return clampRadiusCells(Math.round(numericValue / numericCellsValue));
}

// Proietta le righe della collezione `character.auras` della scheda sul token: mai la
// descrizione, che resta privata.
export function projectSheetAuras(rows) {
  const list = Array.isArray(rows) ? rows : [];
  return list.map((row) => ({
    id: row.id,
    name: typeof row.name === 'string' ? row.name : '',
    effect: typeof row.effect === 'string' ? row.effect : '',
    radiusCells: clampRadiusCells(parseRadiusCells(row.radiusCells)),
    color: AURA_COLORS.includes(row.color) ? row.color : AURA_COLORS[0],
    active: row.active === true,
  }));
}

// Rettangolo dell'aura in caselle: l'ingombro del token proprietario allargato del raggio su
// ogni lato. Con la griglia del PHB (costo 1 per casella, diagonali comprese) la distanza è di
// Chebyshev, quindi l'area è esattamente questo rettangolo.
export function auraRect(ownerToken, radiusCells) {
  const footprint = tokenFootprint(ownerToken);
  const radius = Math.max(0, Math.floor(Number(radiusCells) || 0));
  return {
    x: ownerToken.position.x - radius,
    y: ownerToken.position.y - radius,
    width: footprint.width + radius * 2,
    height: footprint.height + radius * 2,
  };
}

// Un token è dentro l'aura quando almeno una sua casella cade nel rettangolo dell'aura, cioè
// quando i due ingombri si intersecano.
export function isTokenInAura(target, ownerToken, aura) {
  const rect = auraRect(ownerToken, aura?.radiusCells);
  const footprint = tokenFootprint(target);
  const targetRect = { x: target.position.x, y: target.position.y, width: footprint.width, height: footprint.height };
  return rectanglesIntersect(rect, targetRect);
}

// Righe dell'avviso di presenza per l'utente `userId`: salta gli owner contenuti in un veicolo,
// le aure spente, le aure il cui owner è lo stesso utente del soggetto (token proprio o proprio
// famiglio), e restituisce sempre un array vuoto per il Master.
export function auraPresenceFor(state, userId) {
  if (!userId || userId === MASTER_USER_ID) return [];
  const tokens = Array.isArray(state?.tokens) ? state.tokens : [];
  const subjectTokens = tokens.filter((token) => token?.ownerUserId === userId);
  if (subjectTokens.length === 0) return [];

  const rows = [];
  for (const ownerToken of tokens) {
    if (!ownerToken || ownerToken.containedInVehicleId || ownerToken.ownerUserId === userId) continue;
    const auras = Array.isArray(ownerToken.auras) ? ownerToken.auras : [];
    for (const aura of auras) {
      if (!aura || aura.active !== true) continue;
      for (const subject of subjectTokens) {
        if (subject.id === ownerToken.id) continue;
        if (!isTokenInAura(subject, ownerToken, aura)) continue;
        rows.push({
          key: `${ownerToken.id}:${aura.id}:${subject.id}`,
          subjectTokenId: subject.id,
          isFamiliar: subject.isFamiliar === true,
          subjectName: subject.name,
          ownerName: ownerToken.name,
          auraName: aura.name,
          effect: aura.effect,
        });
      }
    }
  }
  return rows;
}
