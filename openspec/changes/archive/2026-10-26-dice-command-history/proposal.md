# dice-command-history

## Why

La textbox dei comandi dadi non permette di richiamare i tiri precedenti con le frecce come un terminale.

## What Changes

- Cronologia locale dei comandi eseguiti con successo.
- Freccia su/giù per richiamo e ritorno alla bozza, senza lanciare dadi automaticamente.

## Capabilities

### New Capabilities

- `dice-command-history`: contratto osservabile descritto nel delta.

### Modified Capabilities

Nessuna, salvo i delta esplicitamente presenti nella directory specs.

## Impact

DicePanel e stato locale dell’input; nessuna modifica al log condiviso o al motore dei dadi.

## Stato e revisione

Apply autorizzato dall’utente; implementazione e verifica completate. Base: `test` a `aff80f748512734e14a6ae9248be4f706cc1eb5b`; branch dedicato `feat/master-creatures-and-dice-workflow`.
