## 1. Schema e credenziali

- [x] 1.1 Creare una nuova migrazione `roles` e `users.role_code`, con backfill e rimozione della vecchia colonna `role`, senza modificare le migrazioni P0.1; verificarne `up`/`down` e `PRAGMA foreign_key_check` su database temporanei vuoti e con utenti referenziati.
- [x] 1.2 Aggiungere `bcrypt` alle dipendenze server e verificare che `npm install` e un confronto hash/password funzionino sul runtime Node del progetto.
- [x] 1.3 Implementare il bootstrap idempotente dei sette utenti del roster con ID stabili, ruolo corretto e hash bcrypt della password `password`, inclusa la conversione una tantum di hash legacy; verificare numero di righe, assenza di password in chiaro, riavvio senza duplicati e errore su conflitto ID/username.

## 2. Autenticazione e permessi backend

- [x] 2.1 Creare repository utenti e auth service che leggono `users`/`roles`, verificano bcrypt e mantengono la sessione in memoria; verificare con test di login valido, password errata, vecchia password rifiutata e utente non presente nel roster.
- [x] 2.2 Collegare `server/index.mjs` al database dopo le migrazioni, sostituire `demoUsers`/`AUTH_USERS_JSON`/scrypt e preservare la forma delle risposte `/api/auth/*`; verificare che il server avvii con DB migrato e dia un errore esplicito con DB non migrato.
- [x] 2.3 Fare risolvere a ogni richiesta l'utente e il ruolo della sessione dal database, mantenendo cookie, TTL e logout; verificare refresh autenticato, logout, scadenza e nuovo login dopo riavvio.
- [x] 2.4 Verificare via API che il Master mantenga i controlli della mappa, che il Player sia respinto da azioni Master anche con `role` o ID falsificati nel payload e che una richiesta anonima riceva 401.

## 3. Frontend e documentazione

- [x] 3.1 Aggiornare `AuthScreen.tsx` con selezione accessibile del roster, campo password vuoto e submit unico da click/Invio, rimuovendo la precompilazione `<username>123`; verificare manualmente selezione, tastiera e assenza delle vecchie password nell'interfaccia.
- [x] 3.2 Allineare `useAuthSession` e la schermata agli stati di caricamento iniziale, invio, errore, nuovo tentativo e logout, impedendo richieste duplicate; verificare il flusso da browser per Master e Player e completare `npm run build`.
- [x] 3.3 Aggiornare README e istruzioni di avvio con `db:migrate`, inizializzazione automatica del roster, password comune e limite delle sessioni in memoria; verificare gli esempi su un database temporaneo e la coerenza con `FEATURES_VTT.md` P0.2.

## 4. Verifica integrata

- [x] 4.1 Eseguire su un database temporaneo la prova P0.2 end-to-end con due browser o client separati: login Master/Player, refresh, permessi, logout e riavvio del server; verificare che ID e token del roster restino associati ai profili corretti e che non compaia alcuna funzione Admin.
