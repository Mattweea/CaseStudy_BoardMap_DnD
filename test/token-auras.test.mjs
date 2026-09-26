import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AURA_COLORS,
  AURA_LIMITS,
  auraPresenceFor,
  auraRect,
  isTokenInAura,
  projectSheetAuras,
  radiusCellsFromUnit,
} from '../shared/token-auras.mjs';
import { normalizeTokenAuras } from '../src/utils/tokens.ts';

function medium(overrides = {}) {
  return { id: 't', name: 'Token', size: 'medium', position: { x: 5, y: 5 }, ...overrides };
}

test('a medium token with radius 2 has a 5x5 area', () => {
  const rect = auraRect(medium(), 2);
  assert.deepEqual(rect, { x: 3, y: 3, width: 5, height: 5 });
});

test('a 2x2 token with radius 1 has a 4x4 area', () => {
  const rect = auraRect(medium({ widthCells: 2, heightCells: 2 }), 1);
  assert.deepEqual(rect, { x: 4, y: 4, width: 4, height: 4 });
});

test('the cell two diagonal steps away is inside a radius-2 area (PHB grid, not the 5-10-5 ruler)', () => {
  const owner = medium({ position: { x: 5, y: 5 } });
  const target = medium({ id: 'target', position: { x: 7, y: 7 } });
  assert.equal(isTokenInAura(target, owner, { radiusCells: 2 }), true);
});

test('a 2x2 token with only one corner inside the area is still inside', () => {
  const owner = medium({ position: { x: 5, y: 5 } });
  const target = medium({ id: 'target', widthCells: 2, heightCells: 2, position: { x: 6, y: 6 } });
  assert.equal(isTokenInAura(target, owner, { radiusCells: 1 }), true);
});

test('radiusCellsFromUnit converts 3m to 2 cells and 4m to 3 cells with 1.5m cells', () => {
  assert.equal(radiusCellsFromUnit(3, 1.5), 2);
  assert.equal(radiusCellsFromUnit(4, 1.5), 3);
});

test('radiusCellsFromUnit clamps to a minimum of 1 and a maximum of AURA_LIMITS.maxRadiusCells', () => {
  assert.equal(radiusCellsFromUnit(0, 1.5), AURA_LIMITS.minRadiusCells);
  assert.equal(radiusCellsFromUnit(1000, 1.5), AURA_LIMITS.maxRadiusCells);
});

test('projectSheetAuras never carries the description', () => {
  const projected = projectSheetAuras([
    { id: 'a1', name: 'Aura di protezione', description: 'Segreta', effect: 'Riduce i danni', radiusCells: '3', color: AURA_COLORS[1], active: true },
  ]);
  assert.deepEqual(projected, [
    { id: 'a1', name: 'Aura di protezione', effect: 'Riduce i danni', radiusCells: 3, color: AURA_COLORS[1], active: true },
  ]);
  assert.equal('description' in projected[0], false);
});

test('auraPresenceFor excludes an aura from its own owner, including their familiar', () => {
  const owner = medium({
    id: 'owner',
    name: 'Ilthar',
    ownerUserId: 'user-a',
    position: { x: 5, y: 5 },
    auras: [{ id: 'a1', name: 'Aura di protezione', effect: 'Riduce i danni', radiusCells: 2, color: AURA_COLORS[0], active: true }],
  });
  const familiar = medium({ id: 'familiar', name: 'Fenrir', ownerUserId: 'user-a', isFamiliar: true, position: { x: 5, y: 5 } });
  const state = { tokens: [owner, familiar] };
  assert.deepEqual(auraPresenceFor(state, 'user-a'), []);
});

test('auraPresenceFor excludes inactive auras and an owner contained in a vehicle', () => {
  const inactiveOwner = medium({
    id: 'owner-inactive',
    name: 'Vesuth',
    ownerUserId: 'user-a',
    position: { x: 5, y: 5 },
    auras: [{ id: 'a-off', name: 'Aura spenta', effect: '', radiusCells: 2, color: AURA_COLORS[0], active: false }],
  });
  const hiddenOwner = medium({
    id: 'hidden-owner',
    name: 'Sylas',
    ownerUserId: 'user-b',
    containedInVehicleId: 'vehicle-1',
    position: { x: 5, y: 5 },
    auras: [{ id: 'a-hidden', name: 'Aura nascosta', effect: '', radiusCells: 2, color: AURA_COLORS[0], active: true }],
  });
  const subject = medium({ id: 'subject', name: 'Ragnar', ownerUserId: 'user-c', position: { x: 5, y: 5 } });
  const state = { tokens: [inactiveOwner, hiddenOwner, subject] };
  assert.deepEqual(auraPresenceFor(state, 'user-c'), []);
});

test('auraPresenceFor names a familiar and returns two rows for two auras, and returns nothing for the master', () => {
  const owner1 = medium({
    id: 'owner1',
    name: 'Ilthar',
    ownerUserId: 'user-a',
    position: { x: 5, y: 5 },
    auras: [{ id: 'a1', name: 'Aura di protezione', effect: 'Riduce i danni', radiusCells: 2, color: AURA_COLORS[0], active: true }],
  });
  const owner2 = medium({
    id: 'owner2',
    name: 'Thalendir',
    ownerUserId: 'user-b',
    position: { x: 5, y: 5 },
    auras: [{ id: 'a2', name: 'Aura di luce', effect: 'Illumina', radiusCells: 2, color: AURA_COLORS[2], active: true }],
  });
  const subject = medium({ id: 'subject', name: 'Ragnar', ownerUserId: 'user-c', position: { x: 5, y: 5 } });
  const familiar = medium({ id: 'familiar', name: 'Fenrir', ownerUserId: 'user-c', isFamiliar: true, position: { x: 5, y: 5 } });
  const state = { tokens: [owner1, owner2, subject, familiar] };

  const rows = auraPresenceFor(state, 'user-c');
  assert.equal(rows.length, 4);
  const familiarRow = rows.find((row) => row.isFamiliar);
  assert.ok(familiarRow);
  assert.equal(familiarRow.subjectName, 'Fenrir');
  assert.equal(familiarRow.ownerName, 'Ilthar');

  assert.deepEqual(auraPresenceFor(state, 'master-user'), []);
});

// Task 3.1: normalizzatore client (src/utils/tokens.ts).

test('normalizeTokenAuras discards a legacy-shaped entry and keeps a valid one', () => {
  const legacyEntry = { id: 'legacy', radiusCells: 3, isVisible: true, color: '#ff0000' };
  const validEntry = { id: 'a1', name: 'Aura di protezione', effect: 'Riduce i danni', radiusCells: 2, color: AURA_COLORS[0], active: true };
  assert.deepEqual(normalizeTokenAuras([legacyEntry, validEntry]), [validEntry]);
  assert.deepEqual(normalizeTokenAuras(undefined), []);
  assert.deepEqual(normalizeTokenAuras(null), []);
});
