## 1. Modello e persistenza
- [x] 1.1 Rispettare la scelta confermata: scheda PG identica per PG/PNG, blocco Manuale dei Mostri per monster e popup al salvataggio; fissare elenco campi comuni/individuali.
- [x] 1.2 Migrazione additiva e repository per definizioni di creatura, senza modificare migrazioni applicate o unicità Adventurer.
- [x] 1.3 Servizio, policy Master-only, patch/conflitti, flush e SSE riservati; ID di collegamento nei token e compatibilità snapshot.
## 2. UI e assegnazione
- [x] 2.1 Creazione/modifica scheda dal token e assegnazione esplicita a selezione o lotto; riusare editor 5e con distinzione modello/istanza.
- [x] 2.2 Bozza senza autoscrittura e popup con elenco destinatari, Applica a tutte/Solo questa/Annulla; propagazione dei soli dati comuni dopo conferma, senza cambiare HP correnti, condizioni, nomi numerati o risorse individuali; scollegamento e cancellazione protetta.
## 3. Verifica
- [x] 3.1 Test Creazione e Collegamento: 4 creature, collegamento a una o più, aggiornamento comune e indipendenza HP/condizioni/risorse.
- [x] 3.2 Test Autorizzazione: HTTP/SSE/ritratto se supportato, nessuna fuga da snapshot, tentativi diretti di Adventurer negati, owner sheet invariata.
- [x] 3.3 Test Durabilità: migrazione/rollback/reapply, riavvio/flush fallito, vecchi snapshot, ID mancante, cancellazione e conflitti.
- [x] 3.4 Valutare e aggiornare i contratti Docs/ai database, backend, frontend e gameplay senza anticipare l’implementazione nei canonici OpenSpec.
- [x] 3.5 npm test, build, docs:check e strict validation; verifica manuale Master più due Adventurer prima di completare i task.

- [x] 3.6 Test Popup: nessuna scrittura prima di Salva/conferma, quattro nomi espliciti anche su scene inattive, nomi omonimi distinti, tutti/una/annulla, fork atomico, gruppo o versioni cambiati e riconferma.
- [x] 3.7 Test parità scheda e azioni Master, consumo risorse per singola istanza e nessuna regressione dell'autosave delle schede Adventurer.
- [x] 3.8 Verificare integrazione con encounter e placement di test, senza duplicare il modello runtime o collocare creature automaticamente creando una definizione.

- [x] 3.9 Schema e UI discriminati monster/character: compilazione, validazione, persistenza e riapertura del blocco mostro; test di incompatibilità tipo/documento e popup condiviso sui mostri.
