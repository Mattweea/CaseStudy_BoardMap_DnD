## Purpose

Consentire al roster fisso di accedere con identità e ruoli persistenti, mantenendo sul server i permessi Master e Player necessari alla partita.

## ADDED Requirements

### Requirement: Baseline SQLite tracciata e ordinata
Il sistema SHALL definire migrazioni separate e ordinate per il registro `schema_migrations`, i ruoli, gli utenti del roster, le campagne, le sessioni e le schede. Il progetto SHALL offrire un comando di sviluppo che ricrea la baseline dopo un backup locale del database corrente.

#### Scenario: Database di sviluppo ricreato
- **WHEN** l'operatore esegue `npm run db:fresh` con il server fermo
- **THEN** il database viene ricreato con tutte le migrazioni nell'ordine definito e il precedente file SQLite resta disponibile come backup locale

### Requirement: Catalogo dei ruoli persistente
Il sistema SHALL avere una tabella `roles` con i soli codici univoci `master` e `adventurer`. Ogni utente SHALL riferire un ruolo tramite chiave esterna e non SHALL esistere un secondo campo di ruolo indipendente.

#### Scenario: Ruolo inesistente
- **WHEN** si tenta di associare un utente a un ruolo non presente in `roles`
- **THEN** il database rifiuta l'operazione

### Requirement: Roster iniziale persistente
La migrazione degli utenti SHALL inserire i sette profili del roster con ID e username stabili, ruolo corretto e hash bcrypt della password iniziale `password`. Non SHALL essere creati account fuori dal roster.

#### Scenario: Prima migrazione
- **WHEN** l'operatore crea un database con `db:migrate` o `db:fresh`
- **THEN** `users` contiene esattamente i profili del roster e nessuna password in chiaro

### Requirement: Login basato su SQLite
Il login SHALL verificare le credenziali dell'username selezionato contro l'utente SQLite e il suo hash bcrypt. Le vecchie password `<username>123` e `AUTH_USERS_JSON` non SHALL fornire credenziali alternative.

#### Scenario: Credenziali valide e non valide
- **WHEN** un partecipante invia `password` per un username del roster oppure invia credenziali errate
- **THEN** il server crea la sessione solo nel primo caso e nel secondo restituisce un errore di credenziali

### Requirement: Sessione e permessi coerenti
Il server SHALL risolvere ID e ruolo da una sessione valida e dal database a ogni richiesta, ignorando ruolo e ID dichiarati dal client. Il logout SHALL invalidare la sessione e le sessioni in memoria SHALL cessare dopo il riavvio del server.

#### Scenario: Tentativo di elevazione del Player
- **WHEN** un Player invia un'azione Master dichiarando `role: master` o l'ID del Master
- **THEN** il server rifiuta l'azione usando il ruolo della sessione

### Requirement: Accesso frontend tramite username del roster
La schermata di login SHALL mostrare le card del roster identificandole con `@username`. Nessun profilo SHALL essere preselezionato. La selezione di una card SHALL rivelare e focalizzare un campo password vuoto, quindi inviare lo username selezionato con un unico submit accessibile. Errori di validazione e di connettività SHALL essere comprensibili.

#### Scenario: Selezione e invio
- **WHEN** l'utente seleziona una card e inserisce la password
- **THEN** il campo password appare per il relativo `@username`, riceve il focus e il submit autentica quel profilo senza richieste duplicate

#### Scenario: Password assente o backend non raggiungibile
- **WHEN** l'utente tenta l'invio senza password oppure il frontend non raggiunge il backend
- **THEN** la UI mostra un messaggio d'errore utile e consente un nuovo tentativo
