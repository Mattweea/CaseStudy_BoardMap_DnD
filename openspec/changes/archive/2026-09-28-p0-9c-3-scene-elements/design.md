# Design

## Context

UnitToken include oggetti e ostacoli ma porta semantiche di iniziativa/selezione non adatte agli arredi. Il dialog Preparazione scena possiede già una preview calibrata e il pattern di scrittura versionata per i disegni; la Board live è soltanto un renderer degli elementi confermati.

## Goals / Non-Goals

**Goals:** libreria minima, trasformazioni persistenti nel dialog e separazione semantica dalla Board live e dai token.

**Non-Goals:** tutti gli esempi progettuali, marketplace, asset esterni o properties da token.

## Decisions

### 1. Modello dedicato

Elemento con ID, kind chiuso, posizione, footprint e rotazione; nessun HP, iniziativa o scheda.

### 2. Set iniziale minimo

L'implementazione sceglie soltanto asset locali già approvati o creati nel progetto, senza promettere alberi, rocce, muri, porte, barili, altari e case tutti insieme.

### 3. Trasformazioni correnti

La preview del dialog usa le coordinate della scena per add/select/move/resize/rotate/remove. Ogni gesto mostra una bozza locale e conferma una sola scrittura versionata al completamento; un rifiuto elimina la bozza e riallinea la scena. La Board normale e fullscreen proietta gli elementi confermati della sola scena attiva senza handler di editing. Le modifiche a una scena inattiva rimangono nel catalogo Master fino all'attivazione.

## Risks / Trade-offs

- [Elementi trattati come token] → Tipi, API e pannelli separati.
- [Editing live non voluto] → Handler di trasformazione confinati alla preview del dialog; layer Board senza hit target interattivi.
- [Asset non autorizzati] → Nessuna dipendenza o download esterno.

## Dipendenze

Dipende da p0-9a-1-scene-model e p0-9a-2-scene-persistence.
