# Scene Map Presentation Specification

## Purpose

Definire come ogni scena presenta una board neutra o un'immagine caricata dal Master, mantenendo accesso, compatibilità e sostituzione sicuri.

## Requirements

### Requirement: P0.9b.1 Background bianco o immagine del Master
Il sistema SHALL consentire al Master di configurare ogni scena con una board bianca oppure con una propria immagine JPEG, PNG o WebP caricata tramite storage runtime autenticato e validato.

#### Scenario: Board bianca
- **WHEN** la scena è configurata senza immagine
- **THEN** la board mostra lo sfondo neutro e la griglia applicativa senza richiedere asset

#### Scenario: Upload valido
- **WHEN** il Master carica un'immagine valida entro i limiti
- **THEN** il server la conserva nello storage runtime e associa alla scena soltanto metadati e URL autenticato

#### Scenario: File o accesso non valido
- **WHEN** il file non supera la validazione o un utente non autorizzato richiede l'asset
- **THEN** il server rifiuta senza sostituire il background corrente

#### Scenario: Nessuna sorgente esterna
- **WHEN** il Master configura il background
- **THEN** P0.9b.1 non accetta URL remote né integra mappe ufficiali o cataloghi esterni

#### Scenario: Conflitto di versione
- **WHEN** un upload o un reset usa una versione base della scena ormai superata
- **THEN** il server rifiuta la mutazione senza sostituire il background corrente

#### Scenario: Compatibilità con scene esistenti
- **WHEN** viene caricata una scena legacy senza configurazione background
- **THEN** il sistema la normalizza come board bianca senza richiedere migrazioni manuali

### Requirement: P0.9b.2 Integrazione con la griglia esistente
La scena attiva SHALL fornire dimensioni e configurazione scene-specific alla griglia applicativa e al sistema esistente di movimento e misurazione, senza introdurre una seconda griglia, una seconda unità o nuove regole di costo.

#### Scenario: Configurazione della scena attiva
- **WHEN** diventa attiva una scena con configurazione valida
- **THEN** griglia, righello, sagome e movimento usano insieme i suoi valori

#### Scenario: Regole di movimento invariate
- **WHEN** un token pianifica o conferma un percorso
- **THEN** costi, diagonalità, budget e validazione restano governati dalla capability esistente

### Requirement: P0.9b.3 Calibrazione dell'immagine sulla griglia applicativa
Il sistema SHALL mostrare al Master una preview dell'immagine rispetto alla griglia esistente e SHALL permettere di modificare e persistere almeno scala dell'immagine, offset X e offset Y.

#### Scenario: Conferma
- **WHEN** il Master regola scala e offset e conferma
- **THEN** il server persiste una sola configurazione versionata e i client vedono l'allineamento confermato

#### Scenario: Annullamento
- **WHEN** il Master modifica la preview ma annulla
- **THEN** scena persistita e altri client restano invariati

#### Scenario: Pan e zoom
- **WHEN** un client esegue pan, zoom o fullscreen dopo la calibrazione
- **THEN** immagine e griglia attraversano la stessa trasformazione di viewport e restano allineate

#### Scenario: Nessun nuovo renderer
- **WHEN** viene renderizzato il background calibrato
- **THEN** usa il sistema grafico già adottato dalla Board senza introdurre una seconda implementazione

### Requirement: P0.9b.4 Switch Dungeon e Combattimento
Il sistema SHALL offrire al Master uno switch esplicito fra modalità utente Dungeon e Combattimento. Dungeon SHALL riusare la modalità tecnica exploration e Combattimento SHALL riusare la modalità tecnica combat.

#### Scenario: Dungeon
- **WHEN** il Master passa a Dungeon secondo il lifecycle consentito
- **THEN** la sessione entra nello stato tecnico exploration e applica il comportamento esistente

#### Scenario: Combattimento
- **WHEN** il Master attiva Combattimento da Dungeon
- **THEN** usa tracker, iniziativa, round e movimento correnti

#### Scenario: Nessuna funzione aggiuntiva
- **WHEN** la sessione è in Dungeon
- **THEN** P0.9b.4 non abilita fog server-side, procedure o regole ulteriori rispetto a exploration

### Requirement: Preview live dei confini della board
Nel dialog di preparazione la preview SHALL aggiornare il confine della board mentre il Master modifica righe e colonne, prima del salvataggio. SHALL distinguere visivamente l'area inclusa da quella esclusa, mostrare il taglio dell'immagine quando esce dai confini e mantenere ogni cella della griglia quadrata anche al ridimensionamento del dialog e del viewport. La preview SHALL rappresentare la bozza locale e SHALL NOT cambiare la scena condivisa finché il Master non conferma.

#### Scenario: Riduzione delle dimensioni
- **WHEN** il Master riduce colonne o righe rispetto all'immagine calibrata
- **THEN** la preview sposta immediatamente il confine e rende riconoscibile la parte dell'immagine che non comparirà sulla board

#### Scenario: Celle quadrate con anteprima ridimensionata
- **WHEN** il dialog o il viewport cambia dimensione
- **THEN** i lati orizzontale e verticale di ogni cella nella preview restano uguali

#### Scenario: Annullamento della bozza
- **WHEN** il Master modifica le dimensioni e chiude il dialog senza salvare
- **THEN** la board e la scena condivisa mantengono le dimensioni precedenti

### Requirement: Board senza confini con dimensioni zero
Una scena configurata con `0 × 0` SHALL avere una griglia logicamente illimitata verso destra e verso il basso a partire dall'origine. Il viewport SHALL mostrare soltanto le celle necessarie alla visuale corrente e SHALL permettere pan e zoom oltre l'immagine calibrata; l'immagine SHALL mantenere la propria estensione, senza essere ripetuta o dilatata per riempire la griglia. Le dimensioni positive SHALL continuare a delimitare la board come prima.

#### Scenario: Nessun ritaglio in modalità illimitata
- **WHEN** il Master salva `0 × 0` e l'immagine supera le vecchie dimensioni della board
- **THEN** il viewport può raggiungere l'intera immagine e proseguire sulla griglia neutra oltre il suo bordo

#### Scenario: Board finita esistente
- **WHEN** viene caricata una scena con righe e colonne positive
- **THEN** il limite della board resta quello persistito e il comportamento corrente non cambia

#### Scenario: Preview della modalità illimitata
- **WHEN** il Master imposta entrambe le dimensioni a zero nella bozza
- **THEN** la preview comunica che non esiste un confine di taglio e mantiene una griglia a celle quadrate

### Requirement: P0.9b.5 Controllo del buio per scena
Il sistema SHALL consentire soltanto al Master di configurare nel dialog di preparazione se il buio è attivo per la scena selezionata. Il valore SHALL appartenere al documento versionato della singola scena; quando la scena è attiva, la configurazione confermata SHALL essere proiettata a tutti i client, mentre una scena inattiva SHALL conservarla senza influenzare la board corrente.

#### Scenario: Preparazione di una scena inattiva
- **WHEN** il Master modifica il buio di una scena inattiva e salva la bozza
- **THEN** il server persiste la nuova versione senza cambiare l'illuminazione della scena attiva

#### Scenario: Attivazione successiva
- **WHEN** il Master attiva una scena preparata con il buio disattivato
- **THEN** Master e Player vedono la board completamente illuminata senza ulteriori azioni

#### Scenario: Modifica della scena attiva
- **WHEN** il Master cambia e salva il buio della scena attiva
- **THEN** tutti i client connessi ricevono la nuova proiezione senza ricaricare

#### Scenario: Annullamento della bozza
- **WHEN** il Master cambia il controllo ma annulla o chiude senza salvare
- **THEN** il documento scena e l'illuminazione condivisa restano invariati

#### Scenario: Autorizzazione
- **WHEN** un utente non Master tenta di modificare il buio di una scena
- **THEN** il server rifiuta la richiesta senza cambiare il documento o la proiezione

#### Scenario: Conflitto di versione
- **WHEN** il Master salva il buio usando una versione base obsoleta
- **THEN** il server rifiuta la mutazione e restituisce la scena corrente per la riconciliazione

#### Scenario: Compatibilità legacy
- **WHEN** il sistema carica una scena priva della configurazione del buio
- **THEN** la normalizza con il buio attivo senza richiedere una migrazione manuale

#### Scenario: Confine della capability
- **WHEN** il Master configura il buio della scena
- **THEN** P0.9b.5 riusa illuminazione e visione esistenti senza introdurre fog server-side o nuove sorgenti luminose
