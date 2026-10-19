# Design

## Context

Il progetto usa collezioni persistenti versionate ma non possiede un aggregato encounter. La sessione combat esistente non deve essere avviata implicitamente.

## Goals / Non-Goals

**Goals:** CRUD coerente, associazione alla scena e separazione dall'avvio combat.

**Non-Goals:** workflow di pubblicazione, stati draft/active inventati o eliminazione cascade.

## Decisions

### 1. Collezione versionata

Ogni encounter ha ID, nome, descrizione opzionale e tipo descrittivo supportato.

### 2. Remove conservativo

Si riusa la rimozione delle collezioni, ma il server rifiuta se esistono placement referenzianti.

### 3. Nessun side effect combat

Creare o aprire un encounter non cambia sessionMode né iniziativa.

## Risks / Trade-offs

- [Encounter equivale a combat] → Scenari narrativi e assenza di side effect coperti da test.
- [Riferimenti orfani] → Vincoli applicativi e rifiuto della rimozione.

## Dipendenze

Dipende da p0-9a-1-scene-model, p0-9a-2-scene-persistence e p0-9a-3-scene-catalog.
