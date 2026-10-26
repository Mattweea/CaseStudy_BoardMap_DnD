# opaque-map-darkness

## Why

Le zone oscurate lasciano intravedere la mappa: il livello attuale usa un riempimento con alpha 0.96.

## What Changes

- Rendere nero pieno ogni punto coperto dal buio.
- Conservare le aperture previste da luci, visione e scurovisione.

## Capabilities

### New Capabilities

- `map-darkness`: contratto osservabile descritto nel delta.

### Modified Capabilities

Nessuna, salvo i delta esplicitamente presenti nella directory specs.

## Impact

Rendering della board e CSS; nessuna migrazione o modifica dei permessi.

## Stato e revisione

Apply autorizzato dall’utente; implementazione e verifica completate. Base: `test` a `aff80f748512734e14a6ae9248be4f706cc1eb5b`; branch dedicato `feat/master-creatures-and-dice-workflow`.
