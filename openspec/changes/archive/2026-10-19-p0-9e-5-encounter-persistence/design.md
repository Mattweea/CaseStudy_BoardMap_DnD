# Design

## Context

P0.9a persiste documenti scena; P0.9e.1–4 definiscono configurazione e placement. Il runtime derivato usa UnitToken e combat state in memoria.

## Goals / Non-Goals

**Goals:** durabilità referenziale della preparazione e confine P0.11 verificabile.

**Non-Goals:** snapshot periodico, flush lifecycle o recupero automatico dello stato live.

## Decisions

### 1. Persistenza incorporata nella scena

Encounter e placement sono sezioni versionate del documento, senza nuovo database parallelo.

Le integrazioni E.1–E.4 coprono già normalizzazione, repository e persist-before-project. E.5 verifica questi percorsi con SQLite reale, riapertura da un processo indipendente e failure injection, senza introdurre una nuova migrazione o duplicare la persistenza.

### 2. Una versione per mutazione

Validazione e scrittura sono atomiche e non lasciano riferimenti orfani.

### 3. Runtime non riscritto

Movimento, HP e condizioni dei token materializzati non aggiornano automaticamente la preparazione.

## Risks / Trade-offs

- [Utente si aspetta recovery live] → Documentare e testare precisamente ciò che torna.
- [Config sovrascritta dal runtime] → Separare adapter di materializzazione e comandi di authoring.

## Dipendenze

Dipende da p0-9a-2-scene-persistence e p0-9e-1/2/3/4.
