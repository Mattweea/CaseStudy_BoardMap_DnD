## Why

Il backend conserva autenticazione e stato live in memoria e usa uno snapshot JSON manuale; manca una base dati su cui salvare le schede previste da P0.2. P0.1 introduce uno schema SQLite riproducibile e migrazioni reversibili prima di aggiungere la persistenza delle funzionalità di gioco.

## What Changes

- Creare un database SQLite locale con percorso configurabile, escluso da Git, e una connessione condivisa che abilita le foreign key e configura il journal.
- Introdurre migrazioni ordinate e versionate con operazioni `up`/`down`, registro `schema_migrations`, applicazione transazionale e rollback dell'ultimo batch.
- Esporre `npm run db:make`, `db:migrate`, `db:status` e `db:rollback`.
- Creare lo schema iniziale per utenti, sessioni, campagne e schede dei personaggi, con chiavi esterne, indici, vincoli e dati della scheda flessibili e versionabili.
- Documentare configurazione, uso delle migrazioni e regola di non modificare file già applicati.

## Capabilities

### New Capabilities

- `sqlite-persistence-foundation`: creazione e configurazione del database, ciclo di vita delle migrazioni e schema iniziale necessario alle schede.

### Modified Capabilities

Nessuna.

## Impact

- Nuovi moduli, migrazioni e file SQLite sotto `database/`; il file locale predefinito è `database/database.sqlite`.
- Nuovi script npm e una dipendenza SQLite lato server; aggiornamento della documentazione e della configurazione Git.
- In P0.1 le tabelle preparano la persistenza futura. Le API di autenticazione, le sessioni attive, lo stato live e lo snapshot JSON mantengono il comportamento attuale; il loro passaggio al database appartiene alle feature successive.
