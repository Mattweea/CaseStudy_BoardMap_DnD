## ADDED Requirements

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
