## ADDED Requirements

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
