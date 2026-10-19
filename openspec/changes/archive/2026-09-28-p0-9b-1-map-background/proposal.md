# Proposal

## Why

Ogni scena deve poter partire da una board bianca o usare un'immagine dell'utente senza introdurre cataloghi di mappe esterni.

## What Changes

- Configura background bianco o immagine JPEG/PNG/WebP caricata dal Master.
- Riusa storage runtime autenticato, validazione dei file e staging atomico.
- Non integra mappe ufficiali, URL remote o sorgenti esterne.

## Capabilities

### New Capabilities

- scene-map-presentation: presentazione della scena sulla board esistente.

### Modified Capabilities

Nessuna.

## Impact

- Nuovi metadati background nel documento scena.
- Nuovo adapter storage e route autenticate secondo il pattern portrait esistente.
