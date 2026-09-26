# Proposal

## Why

La preparazione degli encounter deve sopravvivere al riavvio, mentre round e stato live completo restano responsabilità P0.11.

## What Changes

- Persiste encounter, entity definition e placement con la configurazione scena.
- Avanza la versione una sola volta per mutazione accettata.
- Esclude dalla promessa di recovery HP, movimento, round, condizioni e runtime live.

## Capabilities

### New Capabilities

- encounter-management: configurazione e preparazione degli encounter associati alle scene.

### Modified Capabilities

Nessuna.

## Impact

- Estensione del documento JSON e del service scena.
- Test di riavvio mirati al confine configurazione/runtime.
