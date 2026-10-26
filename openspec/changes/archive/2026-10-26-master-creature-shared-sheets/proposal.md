# master-creature-shared-sheets

## Why

Le schede esistenti appartengono agli Adventurer; il Master vuole schede anche per PG/nemici creati in mappa e una stessa scheda applicabile a più creature uguali.

## What Changes

- Introdurre schede gestite dal Master: PG/PNG con la scheda personaggio esistente, mostri con blocco statistiche ispirato al Manuale dei Mostri 5e 2014.
- Collegare esplicitamente più creature alla stessa scheda, mantenendo indipendente lo stato di ciascun token.
- Al salvataggio mostrare un popup con elenco esatto delle schede/creature coinvolte e scelta fra applicazione a tutte, solo alla corrente o annullamento.
- Persistenza, autorizzazione e sincronizzazione delle schede condivise.

## Capabilities

### New Capabilities

- `master-creature-sheets`: contratto osservabile descritto nel delta.

### Modified Capabilities

Nessuna, salvo i delta esplicitamente presenti nella directory specs.

## Impact

Nuovo tipo di scheda e associazione persistente; database, service/policy/SSE, frontend e normalizzazione token. Dipende dal flusso batch per l’assegnazione in creazione.

## Stato e revisione

Apply autorizzato dall’utente; implementazione e verifica completate. Base: `test` a `aff80f748512734e14a6ae9248be4f706cc1eb5b`; branch dedicato `feat/master-creatures-and-dice-workflow`.

## Precisazione approvata durante Apply
La scheda identica ai personaggi si applica ai PG/PNG. Per le entità monster il Master usa una scheda dedicata in forma di blocco statistiche del Manuale dei Mostri, con dati compilati manualmente e senza importare testi del manuale. Le due forme mantengono autorizzazione e popup dei destinatari condivisi.
