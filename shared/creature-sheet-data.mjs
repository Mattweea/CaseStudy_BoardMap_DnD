export const MONSTER_FIELDS = [
  ['name', 'Nome'],
  ['size', 'Taglia'],
  ['creatureType', 'Tipo e sottotipo'],
  ['alignment', 'Allineamento'],
  ['armorClass', 'Classe armatura'],
  ['armorDescription', 'Armatura'],
  ['hitPointsMaximum', 'Punti ferita massimi'],
  ['hitDice', 'Dadi vita'],
  ['speed', 'Velocità a terra (ft)'],
  ['flySpeed', 'Volo (ft)'],
  ['swimSpeed', 'Nuoto (ft)'],
  ['climbSpeed', 'Scalata (ft)'],
  ['burrowSpeed', 'Scavo (ft)'],
  ['strength', 'Forza'],
  ['dexterity', 'Destrezza'],
  ['constitution', 'Costituzione'],
  ['intelligence', 'Intelligenza'],
  ['wisdom', 'Saggezza'],
  ['charisma', 'Carisma'],
  ['savingThrows', 'Tiri salvezza'],
  ['skills', 'Abilità'],
  ['vulnerabilities', 'Vulnerabilità ai danni'],
  ['resistances', 'Resistenze ai danni'],
  ['damageImmunities', 'Immunità ai danni'],
  ['conditionImmunities', 'Immunità alle condizioni'],
  ['senses', 'Sensi e percezione passiva'],
  ['languages', 'Linguaggi'],
  ['challenge', 'Grado di sfida'],
  ['experience', 'Punti esperienza'],
  ['legendaryDescription', 'Azioni leggendarie disponibili'],
  ['notes', 'Note private'],
  ['hitPointsCurrent', 'PF attuali (individuali)'],
  ['hitPointsTemporary', 'PF temporanei (individuali)'],
];
export const MONSTER_COLLECTIONS = [
  ['traits', 'Tratti'],
  ['actions', 'Azioni'],
  ['bonusActions', 'Azioni bonus'],
  ['reactions', 'Reazioni'],
  ['legendaryActions', 'Azioni leggendarie'],
];
export const MONSTER_ACTION_FIELDS = [
  ['name', 'Nome'],
  ['description', 'Descrizione'],
  ['attackBonus', 'Bonus attacco'],
  ['range', 'Portata/gittata'],
  ['targets', 'Bersagli'],
  ['damageFormula', 'Formula danno'],
  ['damageType', 'Tipo danno'],
  ['recharge', 'Ricarica'],
  ['remaining', 'Usi rimasti (individuali)'],
];
export function emptyMonster(name = '') {
  return {
    kind: 'monster',
    ...Object.fromEntries(MONSTER_FIELDS.map(([key]) => [key, ''])),
    name,
    ...Object.fromEntries(MONSTER_COLLECTIONS.map(([key]) => [key, []])),
  };
}
export function validateMonster(data) {
  if (!data || data.kind !== 'monster' || typeof data !== 'object' || Array.isArray(data))
    return 'Blocco mostro non valido.';
  const allowed = new Set(['kind', ...MONSTER_FIELDS.map(([key]) => key), ...MONSTER_COLLECTIONS.map(([key]) => key)]);
  if (Object.keys(data).some((k) => !allowed.has(k))) return 'Campo non ammesso nel blocco mostro.';
  for (const [key] of MONSTER_FIELDS)
    if (typeof data[key] !== 'string' || data[key].length > 10000) return `Campo mostro non valido: ${key}.`;
  for (const [key] of MONSTER_COLLECTIONS) {
    if (!Array.isArray(data[key]) || data[key].length > 100) return `Collezione mostro non valida: ${key}.`;
    const seen = new Set();
    for (const row of data[key]) {
      if (!row || typeof row.id !== 'string' || !row.id || row.id.length > 100 || seen.has(row.id))
        return 'ID azione non valido.';
      seen.add(row.id);
      const keys = new Set(['id', ...MONSTER_ACTION_FIELDS.map(([k]) => k)]);
      if (Object.keys(row).some((k) => !keys.has(k))) return 'Campo azione non ammesso.';
      for (const [k] of MONSTER_ACTION_FIELDS)
        if (typeof row[k] !== 'string' || row[k].length > 10000) return `Campo azione non valido: ${k}.`;
    }
  }
  return null;
}
const INDIVIDUAL = new Set([
  'current',
  'temporary',
  'remaining',
  'slotsRemaining',
  'successes',
  'failures',
  'active',
  'inspiration',
  'hitPointsCurrent',
  'hitPointsTemporary',
]);
export function splitCreatureData(value) {
  const common = structuredClone(value),
    instance = [];
  function walk(object, path = []) {
    if (!object || typeof object !== 'object') return;
    for (const [key, child] of Object.entries(object)) {
      const part = Array.isArray(object) ? (child.id ?? key) : key;
      const here = [...path, part];
      if (INDIVIDUAL.has(key) && typeof child !== 'object') {
        instance.push({ path: here, value: child });
        object[key] = typeof child === 'boolean' ? false : ['successes', 'failures'].includes(key) ? '0' : '';
      } else walk(child, here);
    }
  }
  walk(common);
  return { common, instance };
}
export function composeCreatureData(common, instance) {
  const data = structuredClone(common);
  for (const { path, value } of instance) {
    let parent = data;
    for (const key of path.slice(0, -1)) {
      parent = Array.isArray(parent) ? parent.find((r) => r.id === key) : parent?.[key];
      if (!parent) break;
    }
    if (parent && Object.hasOwn(parent, path[path.length - 1])) parent[path[path.length - 1]] = value;
  }
  return data;
}
export function applySheetOperation(data, operation) {
  const parts = operation.path.split('.');
  let parent = data;
  for (const key of parts.slice(0, -1))
    parent = Array.isArray(parent) ? parent.find((row) => row.id === key) : parent?.[key];
  if (!parent) throw new TypeError('Percorso scheda non valido.');
  const key = parts[parts.length - 1];
  if (operation.op === 'set') {
    if (!Object.hasOwn(parent, key)) throw new TypeError('Campo non valido.');
    parent[key] = operation.value;
  } else if (operation.op === 'add') {
    if (!Array.isArray(parent[key])) throw new TypeError('Collezione non valida.');
    parent[key].push(structuredClone(operation.value));
  } else if (operation.op === 'remove') {
    if (!Array.isArray(parent)) throw new TypeError('Riga non valida.');
    const i = parent.findIndex((row) => row.id === key);
    if (i < 0) throw new TypeError('Riga mancante.');
    parent.splice(i, 1);
  } else throw new TypeError('Operazione non valida.');
}
