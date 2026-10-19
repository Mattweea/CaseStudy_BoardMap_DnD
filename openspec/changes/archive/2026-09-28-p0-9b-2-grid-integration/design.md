# Design

## Context

token-movement-and-measurement definisce già valore per casella, etichetta, conversioni, percorso e sagome. Board usa una griglia applicativa canonica.

## Goals / Non-Goals

**Goals:** sorgente scene-specific unica e riuso completo degli helper correnti.

**Non-Goals:** nuove unità, formule di costo, diagonalità o una seconda griglia.

## Decisions

### 1. measurementUnit nella scena

La scena attiva è l'unica sorgente, ma la struttura consumata dagli helper resta invariata.

### 2. Calibrazione indipendente

Scala e offset dell'immagine non modificano distanza o costi in celle.

### 3. Cambio atomico

Proiezione scena e unità entrano nello stesso snapshot per evitare valori residui.

## Risks / Trade-offs

- [Due scale divergono] → Eliminare fallback indipendenti e testare ogni consumer.
- [Regressione movimento] → Conservare gli helper e aggiungere test su budget, diagonali e sagome.

## Dipendenze

Dipende da p0-9a-1-scene-model e p0-9a-4-active-scene.
