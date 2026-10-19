# Proposal

## Why

Il Master deve preparare le mappe nel dialog di preparazione scena, mantenendo il disegno distinto da token ed elementi scenici e senza strumenti di modifica sulla board di gioco.

## What Changes

- Aggiunge matita e gomma Master-only nel dialog Preparazione scena, anche per le scene inattive.
- Persiste tratti confermati nel layer drawing della scena.
- La board di gioco mostra i tratti confermati ma non offre strumenti drawing.
- Salva un gesto alla volta; i tratti della scena attiva diventano subito visibili ai partecipanti, quelli delle scene inattive restano privati fino all'attivazione.

## Capabilities

### New Capabilities

- scene-authoring: strumenti Master di preparazione della scena.

### Modified Capabilities

Nessuna.

## Impact

- Nuove operazioni versionate add/erase.
- Editor nella preview di preparazione e layer SVG di sola lettura sulla board, senza nuovo renderer.
