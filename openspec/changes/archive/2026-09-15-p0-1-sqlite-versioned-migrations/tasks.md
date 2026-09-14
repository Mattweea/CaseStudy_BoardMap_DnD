## 1. Fondazione SQLite

- [x] 1.1 Aggiungere `better-sqlite3` e gli script npm `db:make`, `db:migrate`, `db:status`, `db:rollback`; verificare `npm install` e `npm ls better-sqlite3` su Node del progetto.
- [x] 1.2 Creare `database/connection.mjs` con percorso predefinito e `VTT_DB_PATH`, creazione della directory, foreign key, busy timeout e WAL verificati; provare i due percorsi su database temporanei e verificare `PRAGMA foreign_keys` e `PRAGMA journal_mode`.
- [x] 1.3 Confermare l'esclusione Git di `database/database.sqlite` e dei file ausiliari e documentare il percorso configurabile; verificare con `git check-ignore` sui file locali previsti.

## 2. Strumenti di migrazione

- [x] 2.1 Implementare scoperta, validazione e ordinamento dei file in `database/migrations/` e il comando `db:make -- <slug>`; verificare che due generazioni non collidano e che file non validi siano rifiutati.
- [x] 2.2 Implementare `schema_migrations` con nome, batch, data e checksum e il comando `db:migrate` con una transazione `up` + registrazione per file; verificare con test su database temporaneo l'ordine, il secondo avvio no-op e il rollback automatico di una `up` che fallisce.
- [x] 2.3 Implementare rilevamento di migrazioni applicate modificate o mancanti e `db:status` con stato e batch; verificare l'output prima/dopo `migrate` e l'errore senza modifiche al database in caso di checksum divergente.
- [x] 2.4 Implementare `db:rollback` sull'ultimo batch in ordine inverso, con transazione `down` + rimozione del record per file; verificare batch multipli, no-op senza batch e conservazione del record quando `down` fallisce.

## 3. Schema iniziale

- [x] 3.1 Creare migrazioni ordinate con `up`/`down` per `users`, `campaigns`, `sessions` e `character_sheets`, con chiavi esterne, indici, vincoli e JSON valido; verificare su database temporaneo inserimenti validi, rifiuto di riferimenti invalidi e rollback delle quattro tabelle.
- [x] 3.2 Verificare che una scheda possa conservare proprietario, campagna, versione, dati flessibili e date, anche con più schede dello stesso utente nella stessa campagna; controllare i vincoli con test SQL mirati.

## 4. Integrazione e documentazione

- [x] 4.1 Eseguire la sequenza di accettazione P0.1 su un database temporaneo: `db:migrate`, secondo `db:migrate`, `db:make`, `db:status`, nuovo `db:migrate` e `db:rollback`; verificare output, batch e tabelle dopo ogni passaggio.
- [x] 4.2 Aggiornare README con prerequisiti Node, `VTT_DB_PATH`, comandi, immutabilità delle migrazioni, limite del rollback e backup SQLite; verificare che gli esempi funzionino e che le API/sessioni live esistenti continuino ad avviarsi senza usare il database.

## 5. Riorganizzazione della directory

- [x] 5.1 Spostare moduli, CLI e migrazioni da `server/db/` a `database/`; usare `database/database.sqlite` come percorso predefinito, aggiornare script npm, `.gitignore` e README, e verificare che `server/data/last-session.json` continui a essere usato esclusivamente dallo snapshot della sessione.
