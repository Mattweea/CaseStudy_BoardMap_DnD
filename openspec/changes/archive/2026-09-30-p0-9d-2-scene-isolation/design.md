# Design

## Context

Il server già sanitizza per utente alcuni dati, incluso isInvisible, mentre visione/fog resta in parte client-side. P0.9a limita la proiezione alle scene attive.

## Goals / Non-Goals

**Goals:** isolamento fra scene e protezione da mutazioni stale.

**Non-Goals:** garanzia completa che ogni segreto attivo sia escluso dal client.

## Decisions

### 1. Validazione autorevole

Ogni mutazione Player è confrontata con activeSceneId e versione correnti.

### 2. Reset al cambio

Camera, selezione, percorso, righello, sagoma, ping e code di camminata sono effimeri e vengono azzerati.

### 3. Confine P0.10

Si mantengono i filtri esistenti senza presentarli come modello completo di secrets/fog.

## Risks / Trade-offs

- [Mutazione tardiva colpisce la nuova scena] → sceneId/versione obbligatori e rifiuto server.
- [Sicurezza sovrastimata] → Audit e documentazione espliciti sui dati ancora inviati.

## Dipendenze

Dipende da p0-9a-4-active-scene e p0-9d-1-realtime-scene-transition.
