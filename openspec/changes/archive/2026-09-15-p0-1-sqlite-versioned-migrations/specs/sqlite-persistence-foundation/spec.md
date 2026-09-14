## Purpose

Fornire una base dati locale e uno schema evolutivo affidabile, così che le prossime funzionalità possano salvare utenti, sessioni e schede senza dipendere dalla memoria del processo.

## ADDED Requirements

### Requirement: Database locale configurabile
Il sistema SHALL usare SQLite nel percorso `database/database.sqlite` per impostazione predefinita e SHALL consentire di scegliere un altro percorso tramite la variabile d'ambiente `VTT_DB_PATH`. Il database nel percorso predefinito e i suoi file ausiliari SHALL restare esclusi da Git; la documentazione SHALL indicare come evitare il versionamento di un percorso alternativo dentro il repository.

#### Scenario: Primo avvio su checkout pulito
- **WHEN** l'operatore esegue `npm run db:migrate` senza `VTT_DB_PATH` e il database non esiste
- **THEN** il sistema crea la directory necessaria, il database predefinito e lo schema iniziale

#### Scenario: Percorso configurato
- **WHEN** l'operatore imposta `VTT_DB_PATH` a un percorso scrivibile ed esegue `npm run db:migrate`
- **THEN** il sistema usa quel percorso senza creare il database nel percorso predefinito

### Requirement: Connessioni SQLite integre
Ogni connessione al database SHALL abilitare l'applicazione delle foreign key. Il sistema SHALL configurare e verificare il journal mode scelto per l'uso locale previsto e SHALL segnalare un'impostazione non disponibile anziché presumere che sia attiva.

#### Scenario: Relazione non valida
- **WHEN** un'operazione tenta di inserire un record con una foreign key inesistente attraverso una connessione dell'applicazione
- **THEN** SQLite rifiuta l'operazione

#### Scenario: Journal non disponibile
- **WHEN** SQLite non attiva il journal mode configurato
- **THEN** il comando segnala un errore esplicito prima di eseguire migrazioni

### Requirement: Migrazioni ordinate e tracciate
Il sistema SHALL scoprire le migrazioni versionate nel repository, ordinarle per nome e applicare soltanto quelle non registrate. `schema_migrations` SHALL registrare per ciascuna migrazione applicata almeno nome, batch e data di applicazione. Una migrazione già applicata SHALL rimanere immutabile; una modifica rilevata SHALL essere segnalata senza riapplicarla.

#### Scenario: Applicazione iniziale e seconda esecuzione
- **WHEN** l'operatore esegue `npm run db:migrate` due volte senza aggiungere migrazioni
- **THEN** la prima esecuzione applica ogni migrazione una volta nell'ordine dei nomi e la seconda non modifica lo schema né i dati

#### Scenario: Nuova migrazione
- **WHEN** viene aggiunto un file di migrazione valido con un nome ordinabile
- **THEN** la successiva esecuzione di `db:migrate` applica solo quel file e lo registra nel batch corrente

#### Scenario: Migrazione già applicata modificata
- **WHEN** un file già registrato viene modificato
- **THEN** `db:migrate` segnala la divergenza e non modifica il database

### Requirement: Applicazione atomica delle migrazioni
Ogni migrazione SHALL esporre operazioni `up` e `down`. L'esecuzione di `up` e la registrazione del suo esito SHALL avvenire nella stessa transazione. In caso di errore, il sistema SHALL annullare le modifiche di quella migrazione, conservarla come non applicata e terminare con errore.

#### Scenario: Errore durante up
- **WHEN** una migrazione modifica lo schema o i dati e poi fallisce
- **THEN** le sue modifiche e la relativa registrazione sono annullate, mentre le migrazioni precedenti restano applicate

### Requirement: Comandi di gestione delle migrazioni
Il progetto SHALL fornire `npm run db:make`, `npm run db:migrate`, `npm run db:status` e `npm run db:rollback`. `db:make` SHALL generare un file con nome ordinabile e operazioni `up`/`down`; `db:status` SHALL mostrare per ogni file se è applicato o pendente e il batch degli applicati; `db:rollback` SHALL annullare solo l'ultimo batch applicato, in ordine inverso. L'esecuzione di ogni `down` e la rimozione della sua registrazione SHALL essere atomica.

#### Scenario: Creazione e stato di una migrazione
- **WHEN** l'operatore genera una nuova migrazione con `db:make` e consulta `db:status`
- **THEN** il nuovo file contiene `up` e `down` ed è indicato come pendente

#### Scenario: Rollback dell'ultimo batch
- **WHEN** sono presenti migrazioni in più batch e l'operatore esegue `db:rollback`
- **THEN** solo le migrazioni dell'ultimo batch vengono annullate in ordine inverso e risultano pendenti in `db:status`

#### Scenario: Errore durante down
- **WHEN** `down` fallisce durante il rollback
- **THEN** le modifiche di quella migrazione vengono annullate, la sua registrazione resta presente e il comando termina con errore

### Requirement: Schema iniziale per le schede
Le prime migrazioni SHALL creare tabelle per utenti, sessioni, campagne e schede dei personaggi. Le schede SHALL avere un proprietario e una campagna referenziati, un numero di versione, date di creazione e modifica e un campo strutturato flessibile per i dati variabili. Le tabelle SHALL definire chiavi esterne, indici e vincoli appropriati. Questo schema non SHALL modificare il comportamento delle API esistenti né trasferire lo stato live nel database in P0.1.

#### Scenario: Schema pronto per una scheda
- **WHEN** le migrazioni iniziali sono applicate
- **THEN** è possibile salvare una scheda con proprietario e campagna validi, dati strutturati, versione e date di modifica

#### Scenario: Scheda con riferimenti invalidi
- **WHEN** si tenta di salvare una scheda riferita a un utente o a una campagna inesistente
- **THEN** il database rifiuta l'operazione
