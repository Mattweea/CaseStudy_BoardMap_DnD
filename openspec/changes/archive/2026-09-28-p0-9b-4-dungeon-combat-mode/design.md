# Design

## Context

combat-session-mode definisce due stati Esplorazione/Combattimento, sessionMode exploration/combat, autorizzazione Master e lifecycle di iniziativa.

## Goals / Non-Goals

**Goals:** comportamento osservabile richiesto con riuso completo dell'implementazione corrente.

**Non-Goals:** terzo stato, nuovo tracker, automazioni Dungeon o fog server-side.

## Decisions

### 1. Dungeon come nome utente

Il wire e il server conservano exploration; il mapping avviene al bordo UI.

### 2. Combat invariato

Endpoint, roll phase, round e budget continuano a essere governati dalle capability correnti.

### 3. Compatibilità snapshot

Snapshot privi di iniziativa tornano in exploration e vengono mostrati come Dungeon.

## Risks / Trade-offs

- [Rinomina rompe API] → Non cambiare enum o payload tecnico.
- [Funzioni Dungeon implicite] → Specificare esplicitamente l'assenza di nuove meccaniche.

## Dipendenze

Dipende da p0-9a-4-active-scene; riusa combat-session-mode e initiative-rolling canoniche.
