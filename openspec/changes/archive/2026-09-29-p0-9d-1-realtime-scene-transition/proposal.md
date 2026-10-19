# Proposal

## Why

Il Master deve poter cambiare la scena condivisa senza reload e senza invalidare un round di combattimento in corso.

## What Changes

- Attiva una scena e distribuisce atomicamente la nuova proiezione.
- Blocca il cambio durante un round attivo.
- Azzera riferimenti runtime incompatibili quando il cambio è consentito in roll phase.

## Capabilities

### New Capabilities

- multi-scene-session: comportamento realtime e operativo fra scene.

### Modified Capabilities

Nessuna.

## Impact

- Nuova operazione autorevole di attivazione.
- activeSceneId ed eventi scene-aware in SSE e client.
