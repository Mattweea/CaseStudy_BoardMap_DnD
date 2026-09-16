## Purpose

Garantire che le modifiche alla scheda restino aggiornate tra finestre autorizzate durante la sessione, resistano ai conflitti concorrenti e vengano persistite in SQLite senza scrivere a ogni pressione di tasto.

## ADDED Requirements

### Requirement: Patch granulari e stato live autorevole

Ogni modifica SHALL essere inviata come patch riferita a uno o più campi o elementi ripetibili identificati stabilmente. Il server SHALL validare la patch, applicarla allo stato live autorevole e incrementare la versione della scheda prima di confermarla al client.

#### Scenario: Patch valida di un campo

- **WHEN** un client autorizzato invia una patch valida basata sulla versione conosciuta
- **THEN** il server applica la modifica allo stato live, incrementa la versione e restituisce lo stato confermato

#### Scenario: Patch con percorso o valore non valido

- **WHEN** un client invia una patch con un percorso non ammesso o un valore che non rispetta lo schema
- **THEN** il server rifiuta l'intera patch senza modificare lo stato live

### Requirement: Concorrenza per campo ed elemento

Il sistema SHALL usare la versione base della patch e la versione dell'ultima modifica dei percorsi coinvolti. Due modifiche concorrenti a campi o elementi differenti SHALL poter essere entrambe applicate. Una modifica basata su una versione obsoleta dello stesso campo o elemento SHALL essere rifiutata con lo stato corrente e informazioni sufficienti a presentare un conflitto comprensibile.

#### Scenario: Modifiche concorrenti a campi differenti

- **WHEN** proprietario e Master modificano campi differenti partendo dalla stessa versione
- **THEN** il server conserva entrambe le modifiche e distribuisce uno stato che le contiene entrambe

#### Scenario: Modifiche concorrenti allo stesso campo

- **WHEN** proprietario e Master modificano lo stesso campo e la seconda patch si basa su una versione precedente all'ultima modifica di quel campo
- **THEN** il server rifiuta la seconda patch e restituisce il valore e la versione correnti per consentire una scelta esplicita

#### Scenario: Modifiche a elementi ripetibili differenti

- **WHEN** due client modificano elementi con identificatori differenti nella stessa collezione
- **THEN** il sistema tratta le modifiche come indipendenti e non sovrascrive l'intera collezione

### Requirement: Aggiornamenti SSE riservati agli utenti autorizzati

Ogni patch accettata SHALL essere inviata tramite lo stream SSE esistente al proprietario e al Master con identificatore della scheda, versione e modifica confermata. Il server SHALL NOT includere contenuti privati della scheda negli snapshot generici della mappa né negli eventi destinati ad altri Adventurer.

#### Scenario: Proprietario e Master hanno la scheda aperta

- **WHEN** uno dei due modifica un campo e la patch viene accettata
- **THEN** entrambe le finestre ricevono l'aggiornamento confermato senza ricaricare la pagina

#### Scenario: Altro Player connesso allo stream

- **WHEN** una scheda viene modificata mentre un altro Adventurer è connesso
- **THEN** lo stream di quell'Adventurer non espone il contenuto né i dettagli della patch privata

### Requirement: Persistenza SQLite raggruppata

Una patch accettata SHALL segnare la scheda come non persistita e programmare una scrittura SQLite raggruppata dopo circa un secondo dall'ultima modifica. Il sistema SHALL forzare la persistenza alla chiusura esplicita della scheda, al logout, alla fine o sospensione della sessione e durante la chiusura ordinata del server. Un riavvio successivo SHALL caricare l'ultima versione persistita.

#### Scenario: Digitazione continua

- **WHEN** un utente produce più patch ravvicinate sulla stessa scheda
- **THEN** lo stato live si aggiorna per ogni patch ma SQLite riceve una scrittura raggruppata dopo il periodo di inattività

#### Scenario: Chiusura prima del debounce

- **WHEN** l'utente chiude esplicitamente la scheda prima della scrittura programmata
- **THEN** il server persiste immediatamente l'ultima versione live prima di completare la chiusura

#### Scenario: Riavvio dopo il salvataggio

- **WHEN** il server viene riavviato dopo che la versione live è stata persistita
- **THEN** la scheda viene caricata con gli ultimi valori e la versione salvati

### Requirement: Stato di modifica e salvataggio comprensibile

L'interfaccia SHALL distinguere almeno gli stati `Modifica in corso`, `Salvataggio` e `Salvato`. Un errore di patch, conflitto o persistenza SHALL essere mostrato senza dichiarare i dati salvati e SHALL mantenere disponibile il contenuto locale necessario a correggere o riprovare l'operazione.

#### Scenario: Ciclo di salvataggio riuscito

- **WHEN** l'utente modifica un campo, il server accetta la patch e completa la persistenza
- **THEN** l'indicatore passa da modifica a salvataggio e infine a salvato

#### Scenario: Persistenza fallita

- **WHEN** SQLite non riesce a salvare una versione live accettata
- **THEN** l'interfaccia segnala l'errore, non mostra lo stato salvato e il server mantiene la scheda come da persistere per un nuovo tentativo

#### Scenario: Conflitto sullo stesso campo

- **WHEN** il server rifiuta una patch per conflitto
- **THEN** l'interfaccia identifica il campo coinvolto e permette di confrontare il valore locale con quello corrente prima di riprovare

