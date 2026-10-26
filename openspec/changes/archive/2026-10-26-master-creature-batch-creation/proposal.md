# master-creature-batch-creation

## Why

Il master chiede di creare più PG/nemici insieme conservando la nomina legacy. Quantità e numerazione esistono già sia in main sia in davide-features: verificare il percorso raggiungibile prima di aggiungere logica duplicata.

## What Changes

- Garantire un campo Quantità nel percorso di creazione dei PG/nemici del master.
- Preservare la numerazione legacy e una creazione coerente dell’intero lotto.

## Capabilities

### New Capabilities

- `master-creature-batches`: contratto osservabile descritto nel delta.

### Modified Capabilities

Nessuna, salvo i delta esplicitamente presenti nella directory specs.

## Impact

Modale di creazione, collocamento e commit autorevole; possibile ripristino di UI già esistente.

## Stato e revisione

Apply autorizzato dall’utente; implementazione e verifica completate. Base: `test` a `aff80f748512734e14a6ae9248be4f706cc1eb5b`; branch dedicato `feat/master-creatures-and-dice-workflow`.
