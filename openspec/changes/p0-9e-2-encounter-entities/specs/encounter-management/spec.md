## ADDED Requirements

### Requirement: P0.9e.2 Entità mostro e PNG senza modelli duplicati
Il sistema SHALL consentire a un encounter di contenere mostri, PNG o entrambi e SHALL proiettare le istanze preparate nel modello token esistente quando devono comparire sulla board.

#### Scenario: Encounter misto
- **WHEN** il Master aggiunge un mostro e un PNG allo stesso encounter
- **THEN** restano distinguibili e possono avere placement indipendenti

#### Scenario: Proiezione
- **WHEN** un'entità preparata compare sulla board
- **THEN** usa identificatore, geometria, movimento e proprietà compatibili con UnitToken senza un secondo motore token

#### Scenario: Combattimento opzionale
- **WHEN** il Master usa token dell'encounter in combattimento
- **THEN** essi entrano nel tracker e lifecycle esistenti, inclusi nemici senza scheda completa

#### Scenario: Nessuna scheda PC implicita
- **WHEN** viene creata un'entità monster o npc
- **THEN** non viene creata automaticamente una scheda personaggio giocante
