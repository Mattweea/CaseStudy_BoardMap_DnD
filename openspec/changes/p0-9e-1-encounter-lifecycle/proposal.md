# Proposal

## Why

Il Master deve gestire incontri associati alle scene senza assumere che ogni encounter avvii un combattimento.

## What Changes

- Aggiunge create/list/read/update/remove versionati per encounter.
- Consente encounter narrativi, di combattimento o altri incontri supportati.
- Non introduce stati lifecycle artificiali; impedisce rimozioni con placement collegati.

## Capabilities

### New Capabilities

- encounter-management: configurazione e preparazione degli encounter associati alle scene.

### Modified Capabilities

Nessuna.

## Impact

- Nuova collezione encounter nel documento scena.
- Nuove route e sezione Master autorizzate.
