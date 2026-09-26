# Proposal

## Why

Il modello scena deve sopravvivere ai riavvii e assorbire una sola volta la board legacy senza anticipare la persistenza live di P0.11.

## What Changes

- Aggiunge migrazioni SQLite immutabili, repository e optimistic concurrency.
- Persiste catalogo, documenti e riferimento alla scena attiva.
- Esegue una migrazione idempotente della board legacy.

## Capabilities

### New Capabilities

- scene-management: comportamento persistente e autorizzato delle scene.

### Modified Capabilities

Nessuna.

## Impact

- Nuovo schema SQLite e service di persistenza.
- Aggiornamento dei contratti database e stato condiviso.
