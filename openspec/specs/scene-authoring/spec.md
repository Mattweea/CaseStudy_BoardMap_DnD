# Preparazione delle scene

## Purpose

Consente al Master di preparare disegni ed elementi scenici persistenti prima o durante il gioco, mantenendo privata la preparazione delle scene non attive.

## Requirements

### Requirement: P0.9c.1 Disegno separato da elementi e token
Il sistema SHALL consentire al Master di aggiungere tratti con la matita e rimuoverli con la gomma soltanto nel dialog Preparazione scena, conservando i disegni in un layer persistente distinto dagli elementi scenici e dai token. La board di gioco SHALL mostrare i tratti confermati senza strumenti di modifica drawing.

#### Scenario: Tratto confermato
- **WHEN** il Master conclude un gesto valido nella preview della scena selezionata
- **THEN** il client invia una sola operazione versionata e il tratto viene salvato in quella scena

#### Scenario: Scena inattiva preparata
- **WHEN** il Master disegna su una scena inattiva
- **THEN** il tratto rimane disponibile nel suo editor ma non appare sulla board di gioco né negli snapshot dei Player

#### Scenario: Scena attiva modificata
- **WHEN** il Master disegna sulla scena attiva dal dialog
- **THEN** il tratto confermato appare subito sulla board di Master e Player

#### Scenario: Regolazione della matita
- **WHEN** il Master regola lo spessore o sceglie un colore prima di disegnare
- **THEN** vede una preview della dimensione e del colore del pennello senza creare o modificare tratti confermati

#### Scenario: Gomma selettiva
- **WHEN** il Master usa la gomma su uno o più tratti
- **THEN** un indicatore sotto il cursore mostra l'area effettiva della gomma e vengono rimossi soltanto i tratti identificati, non elementi o token sovrapposti

#### Scenario: Player
- **WHEN** un Player visualizza la scena
- **THEN** vede i disegni confermati della sola scena attiva ma non può aprire gli strumenti drawing né inviare operazioni drawing

### Requirement: P0.9c.2 Undo e redo limitati al disegno
Il sistema SHALL offrire al Master undo e redo delle operazioni di disegno, con cronologia limitata a 40 operazioni per scena e non persistita, senza includere altre mutazioni nel command/history model.

#### Scenario: Isolamento per scena
- **WHEN** il Master annulla o ripete sulla scena selezionata
- **THEN** cambia soltanto il layer drawing di quella scena

#### Scenario: Nuova operazione dopo undo
- **WHEN** il Master disegna o cancella dopo un undo
- **THEN** lo stack redo della scena viene svuotato

#### Scenario: Limite
- **WHEN** sono accettate più di 40 operazioni
- **THEN** le inverse più vecchie non sono più disponibili

#### Scenario: Riavvio
- **WHEN** il server viene riavviato
- **THEN** il drawing persistito rimane e la cronologia riparte vuota

### Requirement: P0.9c.3 Elementi scenici trasformabili
Il sistema SHALL fornire al Master, soltanto nel dialog Preparazione scena, una piccola libreria locale di elementi scenici che possono essere aggiunti, selezionati, spostati, ridimensionati, ruotati e rimossi. Gli elementi SHALL restare distinti dai token; la board di gioco SHALL mostrare quelli confermati della scena attiva senza strumenti per modificarli.

#### Scenario: Aggiunta e trasformazione
- **WHEN** il Master aggiunge un elemento supportato o conferma una trasformazione valida nella preview della scena selezionata
- **THEN** posizione, dimensioni e rotazione vengono persistite nella scena e, se attiva, distribuite alla board dei client collegati

#### Scenario: Preparazione di una scena inattiva
- **WHEN** il Master modifica gli elementi di una scena inattiva nel dialog
- **THEN** gli elementi restano nel suo editor e non appaiono sulla board di gioco né negli snapshot dei Player fino all'attivazione della scena

#### Scenario: Semantica non-token
- **WHEN** il Master seleziona un elemento nel dialog
- **THEN** l'interfaccia non mostra HP, condizioni, iniziativa o scheda personaggio

#### Scenario: Board live di sola visualizzazione
- **WHEN** Master o Player visualizzano la scena attiva sulla board normale o fullscreen
- **THEN** vedono gli elementi confermati senza controlli di aggiunta, trasformazione o rimozione

#### Scenario: Autorizzazione
- **WHEN** un Player tenta di modificare gli elementi scenici
- **THEN** il sistema rifiuta l'operazione e non modifica la scena

#### Scenario: Libreria iniziale
- **WHEN** il Master apre la libreria
- **THEN** vede il sottoinsieme iniziale fornito dal progetto senza download o cataloghi esterni

### Requirement: P0.9c.4 Blocchi di movimento e visuale senza anticipare P0.10
Il sistema SHALL permettere al Master di configurare separatamente per un elemento il blocco del movimento e il blocco della visuale e SHALL integrare il footprint con gli helper esistenti.

#### Scenario: Movimento
- **WHEN** un percorso attraversa un footprint blocksMovement
- **THEN** la validazione server esistente rifiuta il segmento secondo le regole correnti

#### Scenario: Visuale
- **WHEN** il calcolo corrente incontra un footprint blocksVision
- **THEN** il client applica il comportamento di visibilità esistente

#### Scenario: Flag indipendenti
- **WHEN** soltanto uno dei due flag è attivo
- **THEN** l'elemento influisce soltanto sul relativo sistema

#### Scenario: Confine P0.10
- **WHEN** un elemento limita la visuale del Player
- **THEN** P0.9c.4 non garantisce che ogni informazione oltre il blocco sia assente dal payload

### Requirement: Pareti strutturali a celle

Il Master SHALL poter dipingere pareti su celle intere tramite pennello e rettangolo e cancellarne celle con una gomma selettiva. Un trascinamento del pennello SHALL riempire anche le celle attraversate fra due posizioni campionate; il rettangolo SHALL riempire l'area inclusa fra gli estremi. Ripassare una cella SHALL NOT duplicarla. Ogni gesto completato SHALL produrre al massimo una scrittura versionata; Escape, perdita del gesto o cambio di strumento SHALL scartare il gesto incompleto. Celle negative, fuori dalla board finita o oltre i limiti consentiti SHALL essere rifiutate senza salvataggi parziali. L'interfaccia SHALL offrire anche un percorso da tastiera per aggiungere o rimuovere celle e definire un rettangolo.

#### Scenario: Pennellata continua

- **WHEN** il Master trascina velocemente il pennello su una fila di celle e rilascia
- **THEN** tutte le celle attraversate diventano parete con una sola scrittura e senza duplicati

#### Scenario: Rettangolo e cancellazione selettiva

- **WHEN** il Master disegna un rettangolo e cancella una delle sue celle con la gomma pareti
- **THEN** il rettangolo viene riempito e la gomma rimuove soltanto la cella strutturale indicata, conservando immagine, disegni, tracciati, elementi e token sovrapposti

#### Scenario: Gesto annullato o fuori limite

- **WHEN** il Master annulla un gesto oppure conferma un insieme contenente coordinate non ammesse
- **THEN** nessuna delle celle del gesto viene salvata e la geometria precedente resta valida

#### Scenario: Controllo da tastiera

- **WHEN** il Master usa i controlli da tastiera per indicare una cella o gli estremi di un rettangolo e conferma l'operazione
- **THEN** ottiene la stessa geometria di un gesto equivalente sulla preview

### Requirement: Pareti continue e blocchi coerenti

Le celle strutturali adiacenti per lato SHALL apparire come una parete continua senza bordi interni nella preview e nella board normale e fullscreen. SHALL contribuire al blocco di movimento, luce, visuale e scurovisione con le stesse celle sul client e sul server, preservando le eccezioni di movimento correnti di Master e veicoli. Un'apertura reale SHALL mantenere il passaggio consentito di movimento, luce e visuale. Le pareti strutturali SHALL restare distinte dai token e dai tracciati, che SHALL conservare i propri comportamenti. La memoria del terreno già esplorato SHALL essere conservata senza concedere visuale attuale sulle creature oltre le pareti.

#### Scenario: Parete composta

- **WHEN** il Master colloca cinque celle adiacenti
- **THEN** la board mostra una parete continua e un movimento Adventurer che la attraversa viene rifiutato integralmente dal server

#### Scenario: Apertura e luce

- **WHEN** una parete a celle presenta un'apertura percorribile e una fonte illumina dal lato opposto
- **THEN** l'apertura lascia passare luce e visuale secondo la geometria esistente, mentre le celle chiuse continuano a occludere

#### Scenario: Coesistenza con un tracciato

- **WHEN** una scena contiene pareti a celle e un tracciato diagonale
- **THEN** entrambi bloccano luce e visuale e soltanto le celle introducono il blocco strutturale del movimento

#### Scenario: Terreno ricordato oltre una nuova parete

- **WHEN** il Master aggiunge una parete a celle in una zona già esplorata
- **THEN** la memoria del terreno resta disponibile e la visione attuale delle creature rispetta la nuova barriera

### Requirement: Persistenza e isolamento delle pareti a celle

Le pareti strutturali SHALL essere salvate nella configurazione versionata della singola scena e ripristinate dopo reload o riavvio. Solo il Master autenticato SHALL poterle modificare. Un conflitto, dati invalidi o un errore di persistenza SHALL lasciare invariati documento, versione, runtime e memoria senza pubblicare un successo parziale. Una modifica accettata della scena attiva SHALL aggiornare la proiezione condivisa una sola volta; una scena inattiva SHALL restare privata. Scene e snapshot precedenti senza celle strutturali SHALL restare validi con una collezione vuota, preservando ostacoli-token e muri esistenti.

#### Scenario: Riapertura e compatibilità

- **WHEN** il server riapre una scena con celle salvate oppure una scena precedente alla funzionalità
- **THEN** recupera nel primo caso le celle confermate e nel secondo una collezione vuota senza conversioni automatiche degli ostacoli esistenti

#### Scenario: Autorizzazione e concorrenza

- **WHEN** una mutazione celle proviene da un client non autenticato, da un Adventurer o da una versione obsoleta
- **THEN** il server la rifiuta senza cambiare geometria o versione e restituisce il contesto di conflitto al Master autorizzato quando applicabile

#### Scenario: Fallimento della persistenza

- **WHEN** il salvataggio delle celle fallisce
- **THEN** documento, proiezione, memoria e versioni conservano il valore precedente e nessun aggiornamento viene trasmesso

#### Scenario: Preparazione privata e pubblicazione attiva

- **WHEN** il Master conferma una modifica a una scena inattiva e successivamente modifica la scena attiva
- **THEN** la prima operazione resta privata e soltanto la seconda produce un aggiornamento della proiezione condivisa della scena attiva

### Requirement: Preparazione delle luci puntuali per scena

Il Master SHALL poter aggiungere, spostare, rimuovere e modificare il raggio delle luci puntuali della scena selezionata nel passaggio Luci e visuale, tramite mappa e controlli da tastiera. Posizione e raggio SHALL rispettare le regole e i limiti esistenti delle luci. Ogni conferma SHALL salvare una configurazione versionata prima della proiezione; le modifiche a una scena inattiva SHALL restare private fino all'attivazione. Autorizzazione, conflitti e fallimenti SHALL preservare l'ultima configurazione confermata. Le modifiche alle luci SHALL NOT creare token o ampliare la memoria per effetto di una sola preview.

#### Scenario: Preparazione e riapertura

- **WHEN** il Master colloca una luce in una scena inattiva, ne salva il raggio e riapre la scena
- **THEN** ritrova posizione e raggio salvati senza aver modificato le luci della board corrente

#### Scenario: Anteprima e annullamento

- **WHEN** il Master modifica posizione o raggio di una luce in bozza e annulla
- **THEN** la configurazione confermata, la memoria e la vista degli altri partecipanti restano invariate

#### Scenario: Mutazione non ammessa

- **WHEN** una modifica luci non è autorizzata, contiene un raggio invalido, usa una versione obsoleta o fallisce la persistenza
- **THEN** nessuna configurazione parziale viene salvata o distribuita e il Master riceve il motivo del rifiuto quando autorizzato

#### Scenario: Luce della scena attiva

- **WHEN** il Master conferma lo spostamento di una luce della scena attiva
- **THEN** la luce salvata viene distribuita una sola volta e la visuale corrente rispetta entrambe le tipologie di parete
