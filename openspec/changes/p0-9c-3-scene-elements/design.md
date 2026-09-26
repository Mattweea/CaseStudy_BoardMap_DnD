# Design

## Context

UnitToken include oggetti e ostacoli ma porta semantiche di iniziativa/selezione non adatte agli arredi. Board possiede già pattern di trasformazione.

## Goals / Non-Goals

**Goals:** libreria minima, trasformazioni persistenti e separazione semantica.

**Non-Goals:** tutti gli esempi progettuali, marketplace, asset esterni o properties da token.

## Decisions

### 1. Modello dedicato

Elemento con ID, kind chiuso, posizione, footprint e rotazione; nessun HP, iniziativa o scheda.

### 2. Set iniziale minimo

L'implementazione sceglie soltanto asset locali già approvati o creati nel progetto, senza promettere alberi, rocce, muri, porte, barili, altari e case tutti insieme.

### 3. Trasformazioni correnti

Preview locale e commit versionato riusano gesture e coordinate della Board.

## Risks / Trade-offs

- [Elementi trattati come token] → Tipi, API e pannelli separati.
- [Asset non autorizzati] → Nessuna dipendenza o download esterno.

## Dipendenze

Dipende da p0-9a-1-scene-model e p0-9a-2-scene-persistence.
