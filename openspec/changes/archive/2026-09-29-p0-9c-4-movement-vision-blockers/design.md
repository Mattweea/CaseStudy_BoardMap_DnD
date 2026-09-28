# Design

## Context

Il server valida il movimento a celle e il client calcola la visuale corrente. Gli elementi P0.9c.3 hanno footprint e trasformazioni proprie.

## Goals / Non-Goals

**Goals:** blocchi indipendenti e riuso degli helper.

**Non-Goals:** collisioni poligonali, seconda griglia, fog server-side o garanzia di segretezza.

## Decisions

### 1. Adapter footprint

Un helper unisce gli ostacoli correnti e gli elementi senza cambiare i loro modelli.

### 2. Rotazione presentazionale

Il footprint rettangolare segue posizione/resize; la rotazione non crea collisioni poligonali.

### 3. Confine visibilità

blocksVision influenza il calcolo corrente ma non promette che dati oltre la vista siano omessi dal payload.

## Risks / Trade-offs

- [Aspettativa di segretezza] → Spec, UI e test esplicitano P0.10.
- [Footprint inatteso con rotazione] → Mostrare il footprint durante la modifica.

## Dipendenze

Dipende da p0-9c-3-scene-elements e riusa token-movement-and-measurement.
