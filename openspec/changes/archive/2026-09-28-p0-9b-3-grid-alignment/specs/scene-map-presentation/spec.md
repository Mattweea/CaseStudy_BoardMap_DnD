## ADDED Requirements

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
