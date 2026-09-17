import type { CharacterSheetData, CharacterSheetPatchOperation } from '../../types/character-sheet';

const skipKeys = new Set(['schemaVersion', 'id']);

// Debug helper: walks the draft and produces the patch operations that blank it.
// Text becomes '', booleans false, repeatable rows are removed. The first resource
// section stays because the UI never lets it be removed.
function clearValues(value: unknown, path: string, operations: CharacterSheetPatchOperation[]) {
  if (typeof value === 'string') {
    if (value !== '') operations.push({ op: 'set', path, value: '' });
    return;
  }
  if (typeof value === 'boolean') {
    if (value) operations.push({ op: 'set', path, value: false });
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (skipKeys.has(key)) continue;
    clearValues(child, path ? `${path}.${key}` : key, operations);
  }
}

export function buildClearOperations(data: CharacterSheetData): CharacterSheetPatchOperation[] {
  const operations: CharacterSheetPatchOperation[] = [];
  const { attacks, equipment, tools, languages, features, resources, ...character } = data.character;

  clearValues(character, 'character', operations);
  clearValues(data.story, 'story', operations);
  clearValues({ ...data.spells, levels: undefined }, 'spells', operations);

  for (const [collection, rows] of Object.entries({ attacks, equipment, tools, languages, features })) {
    rows.forEach((row) => operations.push({ op: 'remove', path: `character.${collection}.${row.id}` }));
  }
  resources.forEach((section, index) => {
    if (index > 0) { operations.push({ op: 'remove', path: `character.resources.${section.id}` }); return; }
    clearValues({ classResource: section.classResource, otherResource: section.otherResource }, `character.resources.${section.id}`, operations);
  });
  for (const [level, group] of Object.entries(data.spells.levels)) {
    clearValues({ slotsTotal: group.slotsTotal, slotsRemaining: group.slotsRemaining }, `spells.levels.${level}`, operations);
    group.spells.forEach((spell) => operations.push({ op: 'remove', path: `spells.levels.${level}.spells.${spell.id}` }));
  }
  return operations;
}
