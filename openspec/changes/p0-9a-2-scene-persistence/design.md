# Design

## Context

Il progetto usa migrazioni immutabili, repository separati e scritture versionate. Gli snapshot legacy possono contenere campi board ma non identità di scena.

## Goals / Non-Goals

**Goals:** durabilità della configurazione, conflitti sicuri, bootstrap idempotente e riapertura coerente.

**Non-Goals:** recovery di round, HP, movimento, log o intero stato live.

## Decisions

### 1. Metadati relazionali e documento JSON

Scene e scena attiva hanno metadati interrogabili; il contenuto flessibile resta nel documento versionato definito da P0.9a.1.

### 2. Persist-before-project

Una mutazione strutturale aggiorna SQLite con versione attesa prima di installare la nuova proiezione.

### 3. Marker idempotente

L'esistenza di una scena persistita impedisce ogni reimport successivo dello snapshot legacy.

## Risks / Trade-offs

- [Conflitti perdono dati] → UPDATE condizionale e risposta 409 con vista corrente.
- [Resume legacy sovrascrive scene] → Bootstrap eseguito solo con catalogo vuoto e coperto da test ripetuti.

## Dipendenze

Dipende da p0-9a-1-scene-model.
