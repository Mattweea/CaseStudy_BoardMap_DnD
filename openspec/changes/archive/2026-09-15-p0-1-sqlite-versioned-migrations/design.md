## Context

Il progetto usa Node 22, Fastify e moduli ESM. `server/index.mjs` costruisce il roster dagli oggetti in `server/characters.mjs`, conserva le sessioni e la partita in memoria e scrive `server/data/last-session.json` solo tramite lo snapshot manuale. Non esistono moduli database né test backend. I requisiti osservabili sono nella delta spec `sqlite-persistence-foundation`.

## Goals / Non-Goals

**Goals:**

- Fornire un unico punto di apertura/configurazione SQLite utilizzabile dai futuri servizi, con comportamento identico tra CLI e server.
- Rendere ripetibili, ispezionabili e reversibili le modifiche di schema senza perdita parziale di una singola migrazione.
- Predisporre lo schema relazionale minimo per P0.2, lasciando spazio alle revisioni e alle nuove entità delle feature successive.

**Non-Goals:**

- Migrare in P0.1 il roster, le sessioni attive, lo stato della mappa o lo snapshot JSON nel database.
- Creare API o interfacce per modificare le schede; importazione, allegati e cronologia appartengono a P0.2.
- Introdurre un sistema completo di campagne o di permessi tra giocatori.

## Decisions

### Accesso SQLite e configurazione

Usare `better-sqlite3` nel solo backend: offre transazioni esplicite e una API sincrona semplice per uno strumento CLI e un server locale. Centralizzare risoluzione del percorso e apertura in `database/connection.mjs`: `VTT_DB_PATH` assoluto viene usato direttamente, quello relativo viene risolto rispetto alla radice del progetto; in assenza della variabile usare `database/database.sqlite`. Creare la directory del database quando serve. Impostare `PRAGMA foreign_keys = ON`, `busy_timeout` e `journal_mode = WAL`, leggendo indietro i valori effettivi e fallendo se foreign key o WAL non sono attivi. Chiudere le connessioni CLI anche in caso di errore. Non aprire una connessione dal percorso normale del server finché il runtime non usa il database.

Alternativa considerata: `node:sqlite`; non è disponibile nel runtime Node 22.12 presente nel progetto, quindi imporrebbe un aggiornamento dell'ambiente. WAL è adatto al database locale con più lettori; non è prevista condivisione del file su filesystem di rete.

### File di migrazione e registro

Collocare moduli, strumenti e file SQLite nella cartella principale `database/`; i file di migrazione sono in `database/migrations/` con prefisso UTC ordinabile, numero progressivo per collisioni e slug, per esempio `20260914_001_create_users.mjs`. `db:make -- <slug>` valida lo slug, evita collisioni e genera export `up(db)` e `down(db)`; il file generato non viene applicato automaticamente. Il runner importa solo file `.mjs` conformi, rifiuta nomi duplicati o export mancanti e li ordina lessicograficamente.

Creare `schema_migrations` con `name` chiave primaria, `batch` intero, `applied_at` e `checksum` SHA-256 del file. Prima di applicare o annullare migrazioni, confrontare i checksum registrati e rifiutare modifiche a file già applicati o file registrati ma mancanti. Le modifiche successive allo schema richiedono nuovi file. `db:status` elenca file pendenti/applicati e batch; segnala anche eventuali divergenze.

Alternativa considerata: registrare solo il nome. È più semplice, ma non permette di rilevare la modifica accidentale di una migrazione già eseguita.

### Semantica di migrate e rollback

Un'invocazione di `db:migrate` che trova file pendenti assegna a tutti il batch successivo. Per ciascun file, acquisire una transazione `BEGIN IMMEDIATE`, ricontrollare lo stato sotto lock, eseguire `up` e inserire il record nello stesso commit. Se `up` fallisce, fare rollback della transazione, uscire con codice non zero e lasciare applicati gli eventuali file precedenti. Una nuova esecuzione senza file pendenti non crea un batch vuoto.

`db:rollback` seleziona il batch massimo e processa i file in ordine inverso. Per ogni file esegue `down` e rimuove il record nella stessa transazione; un errore lascia quel file applicato e interrompe il comando. Un database senza migrazioni applicate produce un no-op esplicito. Le transazioni sono per migrazione, come richiesto dalla roadmap; l'intero batch non è un'unità atomica.

Alternativa considerata: una transazione per l'intero batch. Renderebbe più costoso recuperare un batch con molte migrazioni e non corrisponde al requisito di atomicità per singola migrazione.

### Schema iniziale

Creare migrazioni separate e ordinate per `users`, `campaigns`, `sessions` e `character_sheets`, con `down` che elimina la rispettiva tabella. `users` ha ID stabile, username unico, ruolo e hash password. `campaigns` ha ID, nome e proprietario che referenzia `users`. `sessions` contiene un identificatore/hash di sessione, utente, creazione e scadenza. `character_sheets` contiene ID, `owner_user_id`, `campaign_id`, `version` positiva, `data_json` validato come JSON, `created_at` e `updated_at`. Indici sulle foreign key e sulle query previste per proprietario/campagna/scadenza; vincoli e azioni di cancellazione esplicite preservano l'integrità. Non imporre unicità proprietario/campagna: un utente potrà avere più personaggi. Non creare ancora tabelle per revisioni, allegati, scene o combattimento.

Alternativa considerata: una sola colonna JSON per tutta la scheda. Renderebbe più difficile controllare proprietà, campagna e versione; il modello ibrido mantiene flessibili i contenuti di gioco senza perdere relazioni e metadati.

## Risks / Trade-offs

- [Dipendenza nativa `better-sqlite3` su Windows] → fissare una versione compatibile con il runtime del progetto e verificare l'installazione su checkout pulito.
- [Una migrazione SQLite usa istruzioni non reversibili con un semplice `ALTER TABLE`] → scrivere `down` espliciti e testarli su database temporanei; per cambi futuri usare ricostruzione di tabella quando necessaria.
- [Rollback di un batch parzialmente riuscito] → fermarsi al primo errore, mantenere tracciato lo stato per file e mostrare chiaramente i file ancora applicati in `db:status`.
- [WAL crea file `-wal` e `-shm`] → escludere `database/database.sqlite` e i file ausiliari dal versionamento; documentare backup coerenti e uso locale.

## Migration Plan

1. Aggiungere dipendenza, moduli `database/`, script npm e migrazioni iniziali; aggiornare README e regole Git per il percorso configurabile noto.
2. Verificare su database temporaneo: prima applicazione, secondo `migrate` no-op, nuova migrazione, stato, rollback, errori `up`/`down`, foreign key e override del percorso.
3. Per ambienti esistenti eseguire `db:migrate` prima delle future feature che useranno le tabelle. Non importare automaticamente `last-session.json` e non cambiare i dati in memoria attuali.
4. In sviluppo, tornare indietro con `db:rollback` per l'ultimo batch. Per dati reali, preferire una nuova migrazione correttiva e un backup del database prima di operazioni distruttive.
