# Proposal

## Why

P0.9 attraversa confini funzionali e tecnici che devono poter essere revisionati, applicati e validati autonomamente. Questa change resta quindi un coordinamento senza delta spec proprie; i requisiti osservabili risiedono nelle 21 change foglia denominate P0.9a.1–P0.9e.5.

## What Changes

- **P0.9a — Scene management:** p0-9a-1-scene-model, p0-9a-2-scene-persistence, p0-9a-3-scene-catalog, p0-9a-4-active-scene.
- **P0.9b — Mappe, griglia e calibrazione:** p0-9b-1-map-background, p0-9b-2-grid-integration, p0-9b-3-grid-alignment, p0-9b-4-dungeon-combat-mode.
- **P0.9c — Strumenti di preparazione:** p0-9c-1-drawing, p0-9c-2-undo-redo, p0-9c-3-scene-elements, p0-9c-4-movement-vision-blockers.
- **P0.9d — Sessione multi-scena:** p0-9d-1-realtime-scene-transition, p0-9d-2-scene-isolation, p0-9d-3-atomic-party-transfer, p0-9d-4-integration-multiclient-verification.
- **P0.9e — Encounter management:** p0-9e-1-encounter-lifecycle, p0-9e-2-encounter-entities, p0-9e-3-monster-npc-data, p0-9e-4-encounter-placement, p0-9e-5-encounter-persistence.
- P0.9 persiste catalogo, configurazione e preparazione. Segretezza/fog server-side resta P0.10; persistenza e recovery dello stato live completo resta P0.11.

## Capabilities

Questa change di coordinamento usa skip_specs. Ogni change foglia contiene proposal, delta spec, design e task verificabili propri.

## Impact

- Conserva SQLite, documento JSON versionato, storage runtime autenticato, layer separati, party transfer atomico, blocco switch durante il round e migrazione legacy idempotente.
- Non modifica codice applicativo.
