# Proposal

## Why

Board e realtime necessitano di un'unica proiezione attiva senza inviare ai Player le scene preparate ma inattive.

## What Changes

- Mantiene una sola scena attiva per campagna.
- Proietta la scena attiva nei contratti della board esistente.
- Distribuisce ai Player soltanto identità e contenuto della scena attiva nei limiti della sanitizzazione corrente.

## Capabilities

### New Capabilities

- scene-management: comportamento persistente e autorizzato delle scene.

### Modified Capabilities

Nessuna.

## Impact

- Estensione compatibile di snapshot e SSE.
- Catalogo disponibile solo nella vista Master.
