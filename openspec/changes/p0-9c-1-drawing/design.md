# Design

## Context

Board usa SVG/DOM e coordinate a celle. Il documento P0.9a prevede layer separati e il progetto serializza mutazioni autorevoli.

## Goals / Non-Goals

**Goals:** tratti persistenti, gomma selettiva, bozza locale e sincronizzazione realtime.

**Non-Goals:** editor vettoriale completo, forme avanzate, elementi scenici o undo/redo.

## Decisions

### 1. Polilinee a celle

Ogni tratto ha ID, punti, colore e spessore in coordinate logiche indipendenti dalla viewport.

### 2. Un commit per gesto

Il client campiona la bozza localmente e invia il tratto al pointer-up; la gomma invia gli ID intersecati.

### 3. Layer separato

La gomma può rimuovere solo drawing e non elementi o token sovrapposti.

## Risks / Trade-offs

- [Payload grande] → Semplificazione punti e limiti server.
- [Conflitto con drag token] → Modalità d'interazione esclusiva e annullabile.

## Dipendenze

Dipende da p0-9a-1-scene-model, p0-9a-2-scene-persistence e p0-9a-4-active-scene.
