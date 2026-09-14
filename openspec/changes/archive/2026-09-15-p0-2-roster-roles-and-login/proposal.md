## Why

P0.1 ha preparato le tabelle SQLite, ma il login legge ancora utenti in memoria, usa password demo e non ha una tabella dei ruoli. Prima delle schede persistenti di P0.3 serve un'identità stabile per il roster e un flusso di accesso coerente tra frontend, database e permessi del server.

## What Changes

- Aggiungere con una nuova migrazione `roles` e il collegamento referenziale da `users`, conservando solo `master` e `adventurer`.
- Inizializzare gli utenti del roster attuale in SQLite con ID stabili e password comune letterale `password`, memorizzata come hash bcrypt.
- Usare gli utenti e i ruoli del database per login, verifica della sessione e controlli di autorizzazione già presenti, mantenendo le sessioni attive in memoria.
- Aggiornare la schermata di login: scelta del profilo, password inserita dall'utente, stati di caricamento ed errore chiari, refresh della sessione e logout.
- **BREAKING:** le vecchie password demo `<username>123` e la configurazione `AUTH_USERS_JSON` non sono più sorgenti valide per il login.

## Capabilities

### New Capabilities

- `roster-authentication`: ruoli persistenti, utenti del roster, accesso dal frontend e permessi basati sull'identità autenticata.

### Modified Capabilities

Nessuna. La capability SQLite di P0.1 continua a definire la fondazione e le migrazioni; P0.2 aggiunge l'uso applicativo di utenti e ruoli.

## Impact

- Nuova migrazione in `database/migrations/`, accesso al database nel backend Fastify, bcrypt come dipendenza server e aggiornamento del frontend di login.
- Gli endpoint `/api/auth/login`, `/api/auth/session` e `/api/auth/logout` mantengono la forma delle risposte; il codice che decide i permessi continua a ricevere `master` o `adventurer` dal server.
- Nessuna scheda, account Admin, registrazione libera o persistenza delle sessioni oltre il riavvio in questo change.
