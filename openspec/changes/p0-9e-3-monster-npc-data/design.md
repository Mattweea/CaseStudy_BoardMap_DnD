# Design

## Context

Le character sheet correnti sono orientate ai personaggi giocanti. UnitToken richiede un insieme più piccolo di dati iniziali. Il riferimento a 5e.tools era esplorativo.

## Goals / Non-Goals

**Goals:** dati minimi espliciti, distinzione monster/npc e punto di estensione futuro.

**Non-Goals:** monster sheet definitiva, stat block completo, automazione regole o import dati.

## Decisions

### 1. Minimo derivato da UnitToken

Nome, kind e soli campi iniziali necessari a presentazione, footprint, movimento, iniziativa, HP e visibilità correnti.

### 2. Riferimento opzionale

Se esiste un'entità canonica compatibile, si conserva il riferimento anziché copiare il modello.

### 3. Nessuna integrazione esterna

Import, licensing, provenienza e mapping richiedono una nuova decisione OpenSpec.

## Risks / Trade-offs

- [Minimo cresce in scheda completa] → Ogni campo deve essere giustificato dal mapping runtime corrente.
- [Sorgente esterna introdotta incidentalmente] → Guardrail/test su dipendenze e richieste di rete.

## Dipendenze

Dipende da p0-9e-2-encounter-entities.
