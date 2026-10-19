# Proposal

## Why

La preparazione degli encounter deve sopravvivere al riavvio, mentre round e stato live completo restano responsabilità P0.11.

## What Changes

- Persiste encounter, entity definition e placement con la configurazione scena.
- Avanza la versione una sola volta per mutazione accettata.
- Esclude dalla promessa di recovery HP, movimento, round, condizioni e runtime live.

## Capabilities

### New Capabilities

Nessuna.

### Modified Capabilities

- encounter-management: durabilità della preparazione e separazione dallo stato live.

## Impact

- Verifica del documento JSON e del service scena già integrati in E.1–E.4, senza nuovo schema o storage parallelo.
- Test di riavvio mirati al confine configurazione/runtime.
