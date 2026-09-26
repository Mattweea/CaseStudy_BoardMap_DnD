# Design

## Context

Token, roster, familiari e veicoli possiedono già relazioni e helper. Il server è autorevole per collisioni e movimento.

## Goals / Non-Goals

**Goals:** selezione canonica del party, layout riproducibile e tutto-o-niente.

**Non-Goals:** teletrasporto automatico a ogni switch, trasferimento di nemici o scrittura del runtime completo.

## Decisions

### 1. Party calcolato dal server

Il client non invia una lista arbitraria; il server deriva membri e relazioni dai modelli correnti.

### 2. Preview non mutante

La preview trova footprint liberi deterministicamente ma non prenota né scrive.

### 3. Commit con ricalcolo

Alla conferma il server rivalida versioni, round e spazio e aggiorna entrambe le scene nella stessa transazione.

## Risks / Trade-offs

- [Relazioni spezzate] → Test su familiari, occupanti e ID preservati.
- [Preview stale] → Ricalcolo obbligatorio al commit.
- [Scrittura parziale] → Transazione e installazione runtime solo dopo successo.

## Dipendenze

Dipende da p0-9a-2-scene-persistence, p0-9d-1-realtime-scene-transition e dalle capability canoniche di token/veicoli.
