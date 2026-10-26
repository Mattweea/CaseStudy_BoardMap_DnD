# named-dice-commands

## Why

Il partecipante vuole assegnare un nome facoltativo al tiro direttamente dal comando, per esempio /r 1d12+5 -n "attacco con ascia".

## What Changes

- Aggiungere il suffisso opzionale -n "nome" a /r e /rs.
- Conservare e mostrare nome e formula separatamente nel log autorizzato.
- Rifiutare sintassi malformata senza tirare dadi.

## Capabilities

### New Capabilities

- `named-dice-commands`: contratto osservabile descritto nel delta.

### Modified Capabilities

- `session-dice-rolling`: card del tiro libero con nome esplicito, preservando formula e dettaglio.

## Impact

Parser comando, richiesta/log autorevole, normalizzazione, rendering chat e guida. Non cambia la grammatica della formula né l’entropia.

## Stato e revisione

Apply autorizzato dall’utente; implementazione e verifica completate. Base: `test` a `aff80f748512734e14a6ae9248be4f706cc1eb5b`; branch dedicato `feat/master-creatures-and-dice-workflow`.
