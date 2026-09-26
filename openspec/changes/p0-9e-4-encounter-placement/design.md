# Design

## Context

Gli elementi scenici P0.9c sono non-token. Il modello corrente supporta isInvisible e sanitizzazione parziale, mentre P0.10 definirà secrets/fog completi.

## Goals / Non-Goals

**Goals:** preparazione posizionale, separazione dagli elementi e visibilità coerente col modello corrente.

**Non-Goals:** fog server-side, nuovi livelli di segretezza, elementi scenici o persistenza delle mutazioni live.

## Decisions

### 1. Placement referenziale

Ogni placement riferisce encounter/entity, posizione e trasformazione iniziale con ID stabile.

### 2. Token runtime collegato

L'adapter materializza UnitToken e conserva il collegamento senza copiare le proprietà sceniche.

### 3. Visibilità corrente

Hidden/prepared usa isInvisible o equivalente canonico; nessun nuovo claim di segretezza.

## Risks / Trade-offs

- [Placement e token divergono] → Adapter unico e link stabile.
- [Hidden interpretato come sicuro] → UI, spec e test dichiarano il confine P0.10.

## Dipendenze

Dipende da p0-9e-2-encounter-entities, p0-9e-3-monster-npc-data e dalle trasformazioni Board esistenti.
