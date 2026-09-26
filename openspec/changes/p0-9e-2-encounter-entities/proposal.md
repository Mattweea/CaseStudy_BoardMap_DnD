# Proposal

## Why

Gli encounter devono contenere mostri e PNG riusando il modello token e il combattimento esistenti.

## What Changes

- Consente entità monster, npc o entrambe nello stesso encounter.
- Adatta le istanze preparate a UnitToken quando appaiono sulla board.
- Riusa iniziativa e tracker, inclusi enemy token senza scheda completa.

## Capabilities

### New Capabilities

- encounter-management: configurazione e preparazione degli encounter associati alle scene.

### Modified Capabilities

Nessuna.

## Impact

- Nuova entity definition referenziata dagli encounter.
- Adapter verso UnitToken, nessun secondo modello runtime.
