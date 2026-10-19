# Proposal

## Why

I Player devono operare sulla sola scena attiva senza che P0.9 dichiari prematuramente la sicurezza completa di segreti e fog.

## What Changes

- Rifiuta operazioni Player verso scene inattive o versioni obsolete.
- Omette catalogo, documenti e asset inattivi dalle viste Player.
- Resetta stato effimero client al cambio scena e mantiene il confine P0.10.

## Capabilities

### New Capabilities

Nessuna.

### Modified Capabilities

- multi-scene-session: aggiunge isolamento Player e protezione dalle operazioni stale fra scene.

## Impact

- Sanitizzazione HTTP/SSE e validazione sceneId.
- Reset di camera e interazioni locali.
