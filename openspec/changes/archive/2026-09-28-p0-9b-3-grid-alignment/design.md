# Design

## Context

Board usa coordinate logiche a celle e trasformazioni viewport già condivise da griglia e contenuti. La calibrazione riguarda soltanto i pixel dell'immagine.

## Goals / Non-Goals

**Goals:** allineamento persistente, preview locale e trasformazione coerente.

**Non-Goals:** seconda griglia, modifica dei costi, prospettiva, warping o nuovo renderer.

## Decisions

### 1. Griglia canonica invariata

Scala e offset trasformano il background rispetto alle celle applicative, non il contrario.

### 2. Preview locale

I pointer move aggiornano una bozza; la conferma invia una sola mutazione versionata.

### 3. Un solo sistema di trasformazione

Background e griglia condividono pan/zoom della viewport dopo la trasformazione di calibrazione.

## Risks / Trade-offs

- [Disallineamento a zoom diversi] → Test geometrici su composizione delle trasformazioni.
- [Bozza distribuita per errore] → Separare stato locale e configurazione confermata.

## Dipendenze

Dipende da p0-9b-1-map-background e p0-9b-2-grid-integration.
