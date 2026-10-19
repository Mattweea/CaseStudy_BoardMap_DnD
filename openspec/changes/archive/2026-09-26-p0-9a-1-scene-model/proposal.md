# Proposal

## Why

Le funzionalità P0.9 richiedono un contratto di scena stabile prima di aggiungere persistenza, rendering o encounter.

## What Changes

- Definisce un documento JSON versionato e normalizzato.
- Mantiene separati background, configurazione board, disegni, elementi scenici, placement preparati, token runtime e riferimenti.
- Distingue configurazione persistente e stato live, che resta nel perimetro P0.11.

## Capabilities

### New Capabilities

- scene-management: comportamento persistente e autorizzato delle scene.

### Modified Capabilities

Nessuna.

## Impact

- Nuovi tipi, default, limiti e normalizzatori condivisi.
- Base contrattuale per tutte le sotto-change P0.9.
