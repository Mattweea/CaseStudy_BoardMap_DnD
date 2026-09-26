## ADDED Requirements

### Requirement: P0.9c.3 Elementi scenici trasformabili
Il sistema SHALL fornire al Master una piccola libreria locale di elementi scenici che possono essere aggiunti, selezionati, spostati, ridimensionati, ruotati e rimossi, mantenendoli distinti dai token.

#### Scenario: Aggiunta e trasformazione
- **WHEN** il Master aggiunge un elemento supportato e conferma una trasformazione valida
- **THEN** posizione, dimensioni e rotazione vengono persistite e distribuite

#### Scenario: Semantica non-token
- **WHEN** il Master seleziona un elemento
- **THEN** l'interfaccia non mostra HP, condizioni, iniziativa o scheda personaggio

#### Scenario: Libreria iniziale
- **WHEN** il Master apre la libreria
- **THEN** vede il sottoinsieme iniziale fornito dal progetto senza download o cataloghi esterni
