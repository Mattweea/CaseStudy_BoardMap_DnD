## ADDED Requirements

### Requirement: P0.9e.3 Dati minimi distinti per mostri e PNG
Il sistema SHALL conservare per le entità encounter soltanto i dati necessari alla loro identificazione e preparazione nel modello corrente e SHALL distinguere mostro da PNG senza assumere che usino la scheda di un personaggio giocante.

#### Scenario: Entità senza scheda
- **WHEN** il Master crea un mostro o PNG con i campi minimi validi
- **THEN** può prepararlo e proiettarlo come token senza creare una scheda PC

#### Scenario: Riferimento esistente
- **WHEN** un'entità supportata possiede un riferimento canonico compatibile
- **THEN** l'encounter conserva il riferimento invece di duplicarne l'intero modello

#### Scenario: Nessuna importazione esterna
- **WHEN** il Master gestisce i dati in P0.9e.3
- **THEN** l'applicazione non interroga 5e.tools né altre sorgenti esterne

#### Scenario: Campi non necessari
- **WHEN** un dato non è richiesto da identificazione, preparazione o adapter UnitToken corrente
- **THEN** P0.9e.3 non lo aggiunge come requisito di una scheda mostro
