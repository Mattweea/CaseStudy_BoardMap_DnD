## ADDED Requirements

### Requirement: P0.9e.2 Entità mostro e PNG senza modelli duplicati
Il sistema SHALL consentire al Master di associare a un encounter entità mostro, PNG o entrambe con identificatori stabili e mutazioni versionate. SHALL rendere tali entità proiettabili nel modello token esistente, senza creare una seconda rappresentazione runtime o collocarle automaticamente sulla board.

#### Scenario: Encounter misto
- **WHEN** il Master aggiunge un mostro e un PNG allo stesso encounter
- **THEN** restano distinguibili tramite riferimenti stabili e possono essere usati da placement indipendenti

#### Scenario: Adapter token
- **WHEN** una futura operazione di placement richiede la proiezione di un'entità valida
- **THEN** l'adapter produce identificatore, geometria, movimento e proprietà compatibili con UnitToken senza un secondo motore token

#### Scenario: Combattimento opzionale
- **WHEN** un token derivato viene aggiunto esplicitamente al runtime e il Master avvia il combattimento
- **THEN** può usare il tracker e lifecycle esistenti, anche senza scheda completa; la definizione dell'entità non avvia il combattimento né aggiunge iniziativa

#### Scenario: Nessuna scheda PC implicita
- **WHEN** viene creata un'entità monster o npc
- **THEN** non viene creata automaticamente una scheda personaggio giocante

#### Scenario: Autorizzazione e concorrenza
- **WHEN** un Player tenta di modificare le entità o il Master usa una versione obsoleta della scena
- **THEN** la mutazione viene rifiutata senza alterare l'encounter
