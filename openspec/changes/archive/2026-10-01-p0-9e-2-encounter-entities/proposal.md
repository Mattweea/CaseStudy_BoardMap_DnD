# Proposal

## Why

Gli encounter devono contenere mostri e PNG riusando il modello token e il combattimento esistenti.

## What Changes

- Consente entità monster, npc o entrambe nello stesso encounter.
- Fornisce un adapter verso UnitToken per la futura materializzazione dei placement.
- Verifica la compatibilità dei token derivati con iniziativa e tracker esistenti, inclusi enemy token senza scheda completa.

## Capabilities

### New Capabilities

Nessuna.

### Modified Capabilities

- encounter-management: aggiunge entità mostro e PNG agli encounter già associati alle scene.

## Impact

- Definizioni di entità associate agli encounter tramite riferimenti stabili.
- Adapter verso UnitToken, nessun secondo modello runtime; placement e comparsa sulla board restano a P0.9e.4.
