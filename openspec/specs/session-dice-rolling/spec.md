# session-dice-rolling Specification

## Purpose

Consentire tiri di dadi liberi coerenti tra client, richiesti da interfaccia o comando e consegnati soltanto ai partecipanti autorizzati.

## Requirements

### Requirement: Tiro libero dai controlli nel pannello e da comando

Un partecipante autenticato SHALL poter richiedere un tiro libero tramite controlli a click integrati nella parte inferiore del pannello destro, componendo una selezione che SHALL poter contenere più tipi di dado con la rispettiva quantità; il pulsante di tiro SHALL aprire una modale compatta centrata sulla sola superficie della mappa per impostare un modificatore intero positivo o negativo e la visibilità. La modale SHALL NOT offrire una scelta di vantaggio o svantaggio: il comportamento del `d20` è determinato dalla selezione. La selezione SHALL mostrare la quantità di ogni tipo scelto e SHALL NOT conservare quantità che non entrano nel tiro. SHALL poterlo richiedere anche dal comando `/r` seguito da una formula come `1d20+5` o `1d8 + 3d6`, e dal comando `/rs` con la stessa grammatica per un tiro segreto. Le tre vie SHALL produrre risultati con gli stessi criteri di calcolo e lo stesso formato di log.

#### Scenario: Due modalità equivalenti

- **WHEN** un partecipante tira `1d8+3` dai controlli in basso nel pannello o inserisce `/r 1d8+3`
- **THEN** il log identifica per entrambi formula, singoli dadi, modificatore, totale, autore e momento del tiro

#### Scenario: Selezione di più tipi di dado

- **WHEN** un partecipante sceglie un `d8` e poi tre `d6` dai controlli in basso nel pannello
- **THEN** la selezione mostra entrambe le quantità e il tiro richiesto comprende sia il `d8` sia i tre `d6`

#### Scenario: Quantità azzerata rimossa dalla selezione

- **WHEN** un partecipante riporta a zero la quantità di un tipo di dado che aveva scelto
- **THEN** quel tipo scompare dalla selezione e non compare nella formula inviata

#### Scenario: Nessuna scelta di modalità nella modale

- **WHEN** un partecipante seleziona un `d20` e apre la configurazione del tiro
- **THEN** la modale espone modificatore e visibilità, e nessun controllo di vantaggio o svantaggio

#### Scenario: Tiro durante la navigazione fra tab

- **WHEN** un partecipante cambia dalla tab Chat + Dadi a un'altra tab
- **THEN** può ancora usare i controlli a click nella parte inferiore del pannello e aprire la configurazione del tiro

### Requirement: Richiesta validata e risultato autorevole

Il server SHALL validare la formula o i parametri, generare i singoli esiti e calcolare il totale. La formula SHALL essere una somma di termini separati da `+` o `-`, dove ogni termine è un gruppo `NdS` con `S` fra i dadi supportati oppure un modificatore intero; gli spazi SHALL essere ignorati in qualunque posizione. Un gruppo preceduto da `-` SHALL sottrarre il proprio subtotale dal totale e SHALL NOT produrre singoli dadi con valore negativo. Una formula che contiene un gruppo di `d20` SHALL NOT contenere altri gruppi di dado. Il server SHALL rifiutare una richiesta che supera i limiti dichiarati per numero complessivo di dadi generati, numero di gruppi o valore assoluto della somma dei modificatori. SHALL associare il tiro all'utente della sessione, ignorando risultati, autore e timestamp dichiarati dal client. Una richiesta non valida SHALL produrre un errore leggibile che indica il limite o la regola violata e non SHALL aggiungere un tiro al log.

#### Scenario: Formula con più gruppi

- **WHEN** un partecipante invia `/r 1d8 + 3d6`
- **THEN** il log riporta i singoli esiti di entrambi i gruppi e un totale che li comprende tutti

#### Scenario: Spaziatura irrilevante

- **WHEN** un partecipante invia `/r 1d8+2 + 3d6` oppure `/r 1d8 + 2 + 3d6` oppure `/r 1d8+2+3d6`
- **THEN** le tre richieste producono la stessa formula normalizzata e gli stessi criteri di calcolo

#### Scenario: Gruppo sottratto

- **WHEN** un partecipante invia `/r 1d8 - 1d4`
- **THEN** il subtotale del `d4` viene sottratto dal totale e nessun dado del log espone un valore negativo

#### Scenario: d20 rifiutato in una formula mista

- **WHEN** un partecipante invia `/r 1d20+5 + 6d4`
- **THEN** la richiesta è rifiutata con un errore che spiega che il `d20` si tira da solo, e nessun tiro entra nel log

#### Scenario: Formula non valida

- **WHEN** un partecipante invia `/r` con una formula malformata o valori fuori dai limiti supportati
- **THEN** riceve un errore comprensibile e nessun client riceve un nuovo tiro

#### Scenario: Limiti superati da gruppi combinati

- **WHEN** un partecipante invia una formula i cui gruppi, presi singolarmente entro i limiti, insieme superano il numero complessivo di dadi ammesso
- **THEN** la richiesta è rifiutata con un errore che indica il limite complessivo e nessun tiro entra nel log

#### Scenario: Risultato o autore falsificato

- **WHEN** il client include nel payload un totale o un autore diversi da quelli reali
- **THEN** il server usa soltanto la richiesta di tiro e l'identità autenticata per creare il log

### Requirement: Visibilità pubblica e segreta

Ogni tiro SHALL dichiarare visibilità pubblica o segreta. Un tiro pubblico SHALL essere visibile a tutti i partecipanti autenticati; un tiro segreto SHALL essere visibile soltanto al suo autore e al Master. Nessun contenuto di un tiro segreto, inclusi formula, risultato, anteprima e metadati, SHALL arrivare a un altro Player tramite risposte HTTP, snapshot, SSE o altre operazioni di sessione. Ogni superficie da cui si può tirare SHALL offrire un modo di scegliere la visibilità. Quando la scelta è uno stato che persiste fra un tiro e il successivo, la superficie da cui si tira SHALL indicare quello stato nel momento del tiro, e non soltanto dove lo stato si cambia.

#### Scenario: Tiro pubblico

- **WHEN** un Player esegue un tiro pubblico mentre altri client sono collegati
- **THEN** tutti i partecipanti vedono lo stesso risultato nel proprio log

#### Scenario: Tiro segreto

- **WHEN** un Player esegue un tiro segreto
- **THEN** autore e Master vedono il tiro e gli altri Player non ricevono alcun dato del tiro

#### Scenario: Tiro segreto dal comando

- **WHEN** un partecipante invia `/rs 1d8+3`
- **THEN** il tiro è registrato come segreto e nessun altro Player ne riceve alcun dato

#### Scenario: Stato di visibilità persistente reso evidente

- **WHEN** un partecipante ha attivato una modalità di tiro segreto che vale per i tiri successivi e sta per eseguirne uno
- **THEN** la superficie da cui tira mostra che il tiro sarà segreto, senza che debba tornare a controllare dove ha attivato la modalità

#### Scenario: Recupero dello stato

- **WHEN** un Player non destinatario aggiorna la pagina o si ricollega dopo un tiro segreto
- **THEN** la risposta di stato e i successivi aggiornamenti non contengono quel tiro

### Requirement: Log distinguibile nella tab Chat + Dadi

La tab Chat + Dadi SHALL mostrare i tiri che il partecipante è autorizzato a vedere, distinguendo chiaramente i propri tiri segreti dai tiri pubblici. Il log in P0.3 SHALL funzionare senza una chat testuale. Ogni voce SHALL usare la stessa forma di card qualunque sia l'origine del tiro, libera o dalla scheda del personaggio. La card SHALL mostrare la formula del tiro con un peso tipografico inferiore a quello del totale, che SHALL restare l'elemento dominante; quando il tiro comprende più gruppi, la formula mostrata SHALL rappresentare tutti i gruppi e non soltanto il primo. Il dettaglio dei singoli dadi SHALL essere raggiungibile attivando il totale e SHALL NOT dipendere dal solo passaggio del mouse. Le icone dei dadi nel dettaglio SHALL essere le stesse usate dai controlli di lancio. Una voce originata dalla scheda SHALL aggiungere l'azione che ha prodotto il tiro; una voce senza azione d'origine SHALL NOT ripetere la formula come didascalia.

#### Scenario: Log dell'autore

- **WHEN** l'autore consulta il proprio log dopo tiri pubblici e segreti
- **THEN** vede entrambi e riconosce quali sono segreti

#### Scenario: Dettaglio del risultato

- **WHEN** un partecipante seleziona il totale di un tiro nel log
- **THEN** vede i singoli dadi con il loro risultato e il subtotale dei dadi, separato dal modificatore già espresso nella formula

#### Scenario: Stessa card per origini diverse

- **WHEN** un partecipante confronta nel log un tiro libero e un tiro originato dalla scheda
- **THEN** le due voci hanno la stessa struttura, entrambe mostrano la formula e aprono il dettaglio allo stesso modo, e differiscono soltanto perché quella dalla scheda riporta anche l'azione d'origine

#### Scenario: Formula completa di un tiro a più gruppi

- **WHEN** un partecipante consulta una voce prodotta da due gruppi di dado, per esempio il danno di un attacco con due blocchi
- **THEN** la formula mostrata comprende entrambi i gruppi e corrisponde ai dadi elencati nel dettaglio

#### Scenario: Dettaglio raggiungibile senza puntatore

- **WHEN** un partecipante raggiunge il totale di un tiro dalla scheda usando soltanto la tastiera e lo attiva
- **THEN** il dettaglio dei dadi si apre, senza che sia necessario passare il mouse sul totale

#### Scenario: Voce con più risultati

- **WHEN** una voce contiene più risultati, come la coppia di un `1d20` o i gruppi di un danno misto
- **THEN** ogni totale ha il proprio comando di attivazione e un unico dettaglio mostra i dadi di tutti i risultati

#### Scenario: Icone coerenti fra log e controlli di lancio

- **WHEN** un partecipante confronta l'icona di un `d8` nel dettaglio di una voce con quella del `d8` nei controlli di lancio
- **THEN** le due icone sono la stessa rappresentazione

### Requirement: Tiro libero equo con dettaglio per-dado compatibile

Ogni tiro libero accettato SHALL essere risolto dal motore autorevole equo e SHALL aggiungere al log il dettaglio di tutti i dadi generati con identità, facce, valore, gruppo e disposizione. I campi esistenti `rolls`, `keptRolls`, `modifier` e `total` SHALL restare coerenti con quel dettaglio e disponibili per i client e gli snapshot compatibili. Un dettaglio per-dado assente in uno snapshot precedente SHALL essere accettato come formato legacy; un dettaglio presente ma malformato SHALL essere ignorato senza trasformare dati non validi in un risultato autorevole.

#### Scenario: Tiro normale con più dadi

- **WHEN** un partecipante esegue `2d6+1`
- **THEN** risposta e aggiornamento di stato contengono due dadi `kept` distinti e i campi aggregati riportano gli stessi valori e lo stesso totale

#### Scenario: Un d20 solitario con dettaglio per-dado

- **WHEN** un partecipante esegue `1d20`
- **THEN** risposta e aggiornamento di stato contengono due dadi con disposizione `unresolved` e i campi aggregati (`keptRolls`, `total`) riportano il primo esito, per compatibilità con un lettore che guarda solo i campi di primo livello

#### Scenario: Snapshot precedente alla change

- **WHEN** il server carica una voce di log valida che contiene i campi aggregati ma non il dettaglio per-dado
- **THEN** conserva la voce compatibile senza inventare identità o disposizioni mancanti

#### Scenario: Privacy del dettaglio per-dado

- **WHEN** un Player non destinatario riceve stato o aggiornamenti dopo un tiro segreto altrui
- **THEN** non riceve né il log né alcuna voce del relativo dettaglio per-dado

### Requirement: Il d20 tira sempre una coppia da cui scegliere

Un tiro libero di un solo `d20` SHALL generare due esiti indipendenti, nessuno dei due scelto o scartato dal server, con lo stesso modificatore applicato a entrambi. La scelta di quale contare — il primo per un tiro normale, il maggiore per vantaggio, il minore per svantaggio — SHALL restare della persona che legge il log, che conosce già questa convenzione: la card non SHALL aggiungere un'indicazione testuale che la ripeta. Il client SHALL NOT dichiarare vantaggio o svantaggio prima del tiro. Un tiro che richiede più di un `d20` SHALL produrre altrettanti esiti indipendenti, senza semantica di coppia.

#### Scenario: Un d20 produce due esiti

- **WHEN** un partecipante tira `1d20+5` dai controlli in basso nel pannello o da comando
- **THEN** il log riporta due valori naturali indipendenti con `+5` applicato a entrambi, senza indicare quale sia stato scelto

#### Scenario: Più d20 restano indipendenti

- **WHEN** un partecipante tira `3d20`
- **THEN** il log riporta tre esiti indipendenti, nessuno presentato come alternativa agli altri

#### Scenario: Modalità dichiarata dal client rifiutata

- **WHEN** una richiesta dichiara vantaggio o svantaggio per un tiro libero
- **THEN** il server la rifiuta con un errore leggibile e nessun tiro entra nel log

### Requirement: Compatibilità dei tiri già registrati

L'estensione della formula SHALL NOT alterare i log già presenti nella sessione o nella persistenza. Una voce registrata con un solo gruppo SHALL continuare a essere letta, mostrata e riproposta con lo stesso significato di prima del cambiamento, senza migrazione dei dati. Una voce registrata con vantaggio o svantaggio dichiarati dal client SHALL continuare a essere leggibile, anche se quella modalità non è più producibile.

#### Scenario: Log storico a gruppo singolo

- **WHEN** un partecipante consulta un tiro registrato prima dell'introduzione dei gruppi multipli
- **THEN** formula, singoli dadi, modificatore e totale restano invariati e leggibili

#### Scenario: Log storico con vantaggio

- **WHEN** un partecipante consulta un tiro registrato con vantaggio prima del cambiamento
- **THEN** la voce resta leggibile e continua a distinguere l'esito tenuto da quello scartato

#### Scenario: Ripetizione di un tiro storico

- **WHEN** un partecipante ripete dal log un tiro a gruppo singolo
- **THEN** la richiesta resta valida e produce un nuovo tiro con gli stessi criteri di calcolo
