import type { CharacterKey, GridPosition, InitiativeMode, UserRole } from '../types';

export interface CharacterProfile {
  id: string;
  key: CharacterKey;
  username: string;
  displayName: string;
  role: UserRole;
  imageUrl: string;
  spawnToken: boolean;
  spawnPosition: GridPosition | null;
  initiativeModifier: number;
  initiativeMode: InitiativeMode;
  movement: string | null;
  movementCells: number | null;
  darkvision: string | null;
  notes: string[];
}

export const CHARACTER_PROFILES: CharacterProfile[] = [
  {
    id: 'master-user',
    key: 'master',
    username: 'master',
    displayName: 'Master',
    role: 'master',
    imageUrl: '/media/images/master.jpeg',
    spawnToken: false,
    spawnPosition: null,
    initiativeModifier: 0,
    initiativeMode: 'normal',
    movement: null,
    movementCells: null,
    darkvision: null,
    notes: ['Controllo completo della mappa e dell’iniziativa.'],
  },
  {
    id: 'player-ilthar',
    key: 'ilthar',
    username: 'ilthar',
    displayName: 'Ilthar Neramyst',
    role: 'adventurer',
    imageUrl: '/media/images/ilthar.jpeg',
    spawnToken: true,
    spawnPosition: { x: 2, y: 4 },
    initiativeModifier: 3,
    initiativeMode: 'normal',
    movement: '9 m (30 ft)',
    movementCells: 6,
    darkvision: 'Scurovisione superiore 36 m (120 ft)',
    notes: [],
  },
  {
    id: 'player-thalendir',
    key: 'thalendir',
    username: 'thalendir',
    displayName: 'Thalendir',
    role: 'adventurer',
    imageUrl: '/media/images/thalendir.jpeg',
    spawnToken: true,
    spawnPosition: { x: 4, y: 4 },
    initiativeModifier: 2,
    initiativeMode: 'normal',
    movement: '9 m (30 ft)',
    movementCells: 6,
    darkvision: 'Scurovisione',
    notes: [],
  },
  {
    id: 'player-ragnar',
    key: 'ragnar',
    username: 'ragnar',
    displayName: 'Ragnar',
    role: 'adventurer',
    imageUrl: '/media/images/ragnar.jpeg',
    spawnToken: true,
    spawnPosition: { x: 6, y: 4 },
    initiativeModifier: 2,
    initiativeMode: 'advantage',
    movement: '12 m (40 ft)',
    movementCells: 8,
    darkvision: null,
    notes: ['Vantaggio fisso all’iniziativa.'],
  },
  {
    id: 'player-hunter',
    key: 'hunter',
    username: 'hunter',
    displayName: 'Hunter',
    role: 'adventurer',
    imageUrl: '/media/images/hunter.jpeg',
    spawnToken: true,
    spawnPosition: { x: 8, y: 4 },
    initiativeModifier: 3,
    initiativeMode: 'normal',
    movement: '9 m, anche su muri e soffitti',
    movementCells: 6,
    darkvision: '18 m (60 ft)',
    notes: [
      'Aura of Protection: alleati entro 10 ft aggiungono CHA ai tiri salvezza.',
      'Aura of Hate: alleati entro 10 ft aggiungono CHA ai danni melee.',
    ],
  },
  {
    id: 'player-sylas',
    key: 'sylas',
    username: 'sylas',
    displayName: 'Sylas Elveris',
    role: 'adventurer',
    imageUrl: '/media/images/sylas.jpeg',
    spawnToken: true,
    spawnPosition: { x: 10, y: 4 },
    initiativeModifier: 3,
    initiativeMode: 'normal',
    movement: '9 m (30 ft)',
    movementCells: 6,
    darkvision: '18 m (60 ft)',
    notes: [],
  },
  {
    id: 'player-vesuth',
    key: 'vesuth',
    username: 'vesuth',
    displayName: 'Vesuth Ronavior',
    role: 'adventurer',
    imageUrl: '/media/images/vesuth.png',
    spawnToken: true,
    spawnPosition: { x: 12, y: 4 },
    initiativeModifier: 2,
    initiativeMode: 'normal',
    movement: '9 m',
    movementCells: 6,
    darkvision: 'Nessuna',
    notes: [],
  },
];

export function findCharacterProfileByUsername(username: string) {
  const normalized = username.trim().toLowerCase();
  return CHARACTER_PROFILES.find((profile) => profile.username === normalized) ?? null;
}

export function findCharacterProfileByKey(key: CharacterKey | null | undefined) {
  return CHARACTER_PROFILES.find((profile) => profile.key === key) ?? null;
}
