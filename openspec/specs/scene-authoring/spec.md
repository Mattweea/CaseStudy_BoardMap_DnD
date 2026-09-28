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
