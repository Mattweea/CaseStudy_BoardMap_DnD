# Design

## Context

I consumer correnti leggono campi board top-level. Inviare tutti i documenti nello snapshot aumenterebbe payload ed esporrebbe preparazione inattiva.

## Goals / Non-Goals

**Goals:** proiezione compatibile, una sola activeSceneId e viste differenziate per ruolo.

**Non-Goals:** switch realtime completo, P0.10 secrets filtering o runtime recovery P0.11.

## Decisions

### 1. Proiezione top-level compatibile

I campi esistenti rappresentano inizialmente la scena attiva e vengono composti da helper centralizzati.

### 2. Catalogo fuori dal payload Player

Master riceve summary/versioni; Player riceve solo la scena attiva.

### 3. Dettagli caricati a richiesta

I documenti inattivi non vengono incorporati in ogni broadcast Master.

## Risks / Trade-offs

- [Payload divergenti per ruolo] → Fixture e test per Master e più Player.
- [Campi legacy senza scena] → Normalizzatore assegna la scena iniziale senza rompere i consumer.

## Dipendenze

Dipende da p0-9a-1-scene-model e p0-9a-2-scene-persistence; p0-9d-1 governa la transizione realtime.
