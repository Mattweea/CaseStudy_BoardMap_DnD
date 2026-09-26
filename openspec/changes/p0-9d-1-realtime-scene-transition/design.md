# Design

## Context

Il server serializza mutazioni e possiede il lifecycle combat con roll phase e round attivo. P0.9a definisce scena attiva e catalogo.

## Goals / Non-Goals

**Goals:** switch realtime atomico, autorizzato e coerente col combattimento.

**Non-Goals:** trasferimento implicito del party, recovery runtime P0.11 o filtraggio segreti P0.10.

## Decisions

### 1. Round attivo blocca

Il controllo è server-side e precede ogni scrittura o installazione della nuova proiezione.

### 2. Roll phase resettata

Se lo switch avviene prima del round, tracker, budget e riferimenti della vecchia scena vengono azzerati.

### 3. Installazione atomica

Configurazione e runtime di destinazione sono validati prima di cambiare activeSceneId e fare broadcast.

## Risks / Trade-offs

- [Client applica eventi tardivi] → Includere sceneId e ignorare eventi non attivi.
- [Cambio parziale su errore] → Persistenza/validazione prima dell'installazione e failure injection.

## Dipendenze

Dipende da p0-9a-4-active-scene e p0-9b-4-dungeon-combat-mode.
