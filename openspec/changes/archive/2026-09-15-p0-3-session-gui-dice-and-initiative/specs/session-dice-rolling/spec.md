## Purpose

Consentire tiri di dadi liberi coerenti tra client, richiesti da interfaccia o comando e consegnati soltanto ai partecipanti autorizzati.

## ADDED Requirements

### Requirement: Tiro libero dai controlli nel pannello e da comando
Un partecipante autenticato SHALL poter richiedere un tiro libero tramite controlli a click integrati nella parte inferiore del pannello destro, scegliendo dado e quantità; il pulsante di tiro SHALL aprire una modale compatta centrata sulla sola superficie della mappa per impostare un modificatore intero positivo o negativo, modalità e visibilità. SHALL poterlo richiedere anche dal comando `/r` seguito da una formula come `1d20+5`. Le due modalità SHALL produrre risultati con gli stessi criteri di calcolo e lo stesso formato di log.

#### Scenario: Due modalità equivalenti
- **WHEN** un partecipante tira `1d20+5` dai controlli in basso nel pannello o inserisce `/r 1d20+5`
- **THEN** il log identifica per entrambi formula, singoli dadi, modificatore, totale, autore e momento del tiro

#### Scenario: Tiro durante la navigazione fra tab
- **WHEN** un partecipante cambia dalla tab Chat + Dadi a un'altra tab
- **THEN** può ancora usare i controlli a click nella parte inferiore del pannello e aprire la configurazione del tiro

### Requirement: Richiesta validata e risultato autorevole
Il server SHALL validare la formula o i parametri, generare i singoli esiti e calcolare il totale. SHALL associare il tiro all'utente della sessione, ignorando risultati, autore e timestamp dichiarati dal client. Una richiesta non valida SHALL produrre un errore leggibile e non SHALL aggiungere un tiro al log.

#### Scenario: Formula non valida
- **WHEN** un partecipante invia `/r` con una formula malformata o valori fuori dai limiti supportati
- **THEN** riceve un errore comprensibile e nessun client riceve un nuovo tiro

#### Scenario: Risultato o autore falsificato
- **WHEN** il client include nel payload un totale o un autore diversi da quelli reali
- **THEN** il server usa soltanto la richiesta di tiro e l'identità autenticata per creare il log

### Requirement: Visibilità pubblica e segreta
Ogni tiro SHALL dichiarare visibilità pubblica o segreta. Un tiro pubblico SHALL essere visibile a tutti i partecipanti autenticati; un tiro segreto SHALL essere visibile soltanto al suo autore e al Master. Nessun contenuto di un tiro segreto, inclusi formula, risultato, anteprima e metadati, SHALL arrivare a un altro Player tramite risposte HTTP, snapshot, SSE o altre operazioni di sessione.

#### Scenario: Tiro pubblico
- **WHEN** un Player esegue un tiro pubblico mentre altri client sono collegati
- **THEN** tutti i partecipanti vedono lo stesso risultato nel proprio log

#### Scenario: Tiro segreto
- **WHEN** un Player esegue un tiro segreto
- **THEN** autore e Master vedono il tiro e gli altri Player non ricevono alcun dato del tiro

#### Scenario: Recupero dello stato
- **WHEN** un Player non destinatario aggiorna la pagina o si ricollega dopo un tiro segreto
- **THEN** la risposta di stato e i successivi aggiornamenti non contengono quel tiro

### Requirement: Log distinguibile nella tab Chat + Dadi
La tab Chat + Dadi SHALL mostrare i tiri che il partecipante è autorizzato a vedere, distinguendo chiaramente i propri tiri segreti dai tiri pubblici. Il log in P0.3 SHALL funzionare senza una chat testuale.

#### Scenario: Log dell'autore
- **WHEN** l'autore consulta il proprio log dopo tiri pubblici e segreti
- **THEN** vede entrambi e riconosce quali sono segreti

#### Scenario: Dettaglio del risultato

- **WHEN** un partecipante seleziona il totale di un tiro nel log
- **THEN** vede i singoli dadi con il loro risultato e il subtotale dei dadi, separato dal modificatore già espresso nella formula
