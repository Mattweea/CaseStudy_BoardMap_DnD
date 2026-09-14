## Context

La fondazione SQLite di P0.1 è in `database/` e la tabella `users` contiene oggi un campo testuale `role` con vincolo locale. `server/index.mjs` costruisce gli utenti da `server/characters.mjs` o `AUTH_USERS_JSON`, usa scrypt con sale condiviso e conserva le sessioni in una `Map`. `src/components/AuthScreen.tsx` seleziona profili statici e precompila `<username>123`; `useAuthSession` usa già gli endpoint `/api/auth/*` e cookie HTTP-only. I controlli della mappa confrontano `user.role` con `master`, quindi la forma del profilo autenticato deve restare compatibile. Vedere `proposal.md` e la delta spec `roster-authentication` per gli obiettivi osservabili.

## Goals / Non-Goals

**Goals:**

- Rendere SQLite la fonte dell'identità e del ruolo, conservando gli ID del roster e il contratto delle API esistenti.
- Far funzionare il login dopo una inizializzazione ripetibile senza modifiche manuali al database.
- Separare query utenti, verifica delle credenziali e decisioni di ruolo con moduli piccoli e funzioni esplicite.

**Non-Goals:**

- Account Admin, iscrizione, reset password, gestione utenti o ruoli da UI.
- Autorizzazioni per singola scheda o campagna, riservate a P0.3.
- Sessioni persistenti in SQLite o stato live persistente, riservati a P0.9.

## Decisions

### Migrazione dei ruoli

Creare una nuova migrazione in `database/migrations/`; non toccare `20260914_001_create_users.mjs`, perché le migrazioni applicate hanno checksum. Usare `roles(code TEXT PRIMARY KEY)` con i soli record `master` e `adventurer`. Aggiungere a `users` `role_code` con foreign key verso `roles(code)`, copiare i valori del vecchio `role` e rimuovere la colonna precedente nella stessa migrazione. Poiché SQLite consente di aggiungere una colonna referenziata nullable a una tabella esistente, verificare il backfill e imporre che `role_code` non resti nullo anche per futuri inserimenti/aggiornamenti (vincolo o trigger nella migrazione). Verificare `PRAGMA foreign_key_check` e preservare gli ID già referenziati da `sessions`, `campaigns` e `character_sheets`. Il `down` ripristina il campo compatibile con P0.1 prima di rimuovere `role_code` e `roles`.

Alternativa considerata: tenere `users.role` accanto a una nuova relazione. Creerebbe due valori potenzialmente divergenti e contraddirebbe la fonte unica del ruolo.

### Inizializzazione del roster e password

All'avvio del server, dopo l'apertura del database, richiedere lo schema migrato e inizializzare in modo idempotente i sette profili definiti in `server/characters.mjs`. Inserire solo i record mancanti con gli stessi `id`, `username` e ruoli del roster; se un ID e uno username esistenti si contraddicono, fallire con un errore chiaro anziché creare un doppione. Per eventuali record legacy del roster con hash non bcrypt, convertirli una volta alla password concordata `password`; non rigenerare hash bcrypt già presenti né sovrascrivere ruoli esistenti nei riavvii successivi. Conservare nel database soltanto l'hash con salt incorporato. Il roster statico continua a fornire immagini, nome visualizzato e attributi di gioco, ma non credenziali né il ruolo autorizzativo.

Usare il pacchetto `bcrypt` per generare gli hash iniziali e confrontare le password al login; il confronto avviene fuori dalle transazioni SQLite. Evitare una migrazione che inserisca hash generati dinamicamente: le migrazioni descrivono lo schema, mentre il bootstrap idempotente gestisce i dati iniziali.

Alternativa considerata: lasciare gli account nell'array `demoUsers` e copiare solo le credenziali. Non darebbe a P0.3 un proprietario SQLite affidabile.

### Flusso backend e permessi

Introdurre un repository utenti che interroga `users` con join su `roles`; un auth service verifica bcrypt, crea/invalida la sessione in memoria e compone il profilo pubblico; una policy di ruolo mantiene i controlli Master/Player. Rimuovere l'autenticazione basata su `AUTH_USERS_JSON`, `demoUsers` e scrypt. `getSessionUser` risolve l'ID della sessione dal database a ogni richiesta, così il ruolo applicato è quello corrente e non un valore del payload. Mantenere cookie, TTL e struttura di `/api/auth/login`, `/api/auth/session`, `/api/auth/logout`, inclusi gli ID dei token del giocatore. Chiudere la connessione SQLite all'arresto Fastify; se schema o database non sono pronti, fallire l'avvio con indicazione di eseguire `npm run db:migrate`, senza usare utenti demo come fallback.

Alternativa considerata: persistere subito i record `sessions`. P0.2 richiede soltanto di mantenere la sessione durante refresh e di consentire un nuovo login dopo il riavvio; la durata oltre il riavvio è prevista in P0.9.

### Interfaccia di login

Riutilizzare le card del roster come selettore di profilo, con stato selezionato accessibile. Mostrare sempre un modulo password vuoto e un unico percorso di submit per click e Invio; rimuovere la precompilazione `${username}123`. Durante l'invio disabilitare richieste duplicate, mostrare uno stato di attesa e un errore vicino al campo, quindi permettere il nuovo tentativo. Conservare i dettagli visivi dei personaggi e la UI Master/Player dopo il login. `useAuthSession` continua a recuperare la sessione al caricamento e a gestire il logout; l'interfaccia distingue caricamento iniziale e invio delle credenziali.

Alternativa considerata: sostituire le card con un login username libero. Il roster è deliberatamente fisso e la selezione attuale aiuta gli amici a riconoscere il personaggio.

## Risks / Trade-offs

- [Password condivisa tra profili] → documentare che i ruoli impediscono errori d'uso, non l'impersonificazione tra amici; non trattare le future schede come dati riservati contro chi conosce la password.
- [Migrazione SQLite della colonna `role` con tabelle figlie] → usare una migrazione transazionale, testare con righe e foreign key già presenti, controllare il `down` senza disabilitare permanentemente le foreign key.
- [Bootstrap che modifica credenziali legacy] → convertire solo hash non bcrypt dei profili noti e non toccare hash bcrypt già inizializzati.
- [Dipendenza bcrypt nativa] → verificare installazione e test sul runtime Node usato dal progetto.
- [Database non migrato all'avvio] → errore esplicito con comando da eseguire, senza fallback silenzioso a credenziali demo.

## Migration Plan

1. Aggiungere la migrazione `roles`/`users.role_code` e verificarne `up`, `down` e integrità su database temporanei sia vuoti sia con righe referenziate.
2. Aggiungere bcrypt, repository, bootstrap e auth service; avviare il server solo dopo `npm run db:migrate`. Gli utenti legacy del roster ricevono la nuova password comune al primo avvio.
3. Aggiornare frontend e documentazione delle credenziali. Verificare login Master/Player, refresh, logout, vecchie password rifiutate e controlli di ruolo via API.
4. Per tornare al codice precedente in sviluppo, eseguire `db:rollback` solo dopo aver fermato il server e aver valutato i dati inseriti; gli hash bcrypt non saranno verificabili dal vecchio login scrypt. Preferire una migrazione correttiva se il database contiene dati da conservare.
