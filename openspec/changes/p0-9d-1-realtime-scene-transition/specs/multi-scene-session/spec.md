## ADDED Requirements

### Requirement: P0.9d.1 Transizione realtime della scena attiva
Il sistema SHALL consentire soltanto al Master di attivare una scena e SHALL distribuire atomicamente la nuova proiezione a tutti i client connessi. Il server SHALL rifiutare il cambio mentre un round di combattimento è attivo.

#### Scenario: Cambio in Dungeon
- **WHEN** il Master attiva una scena in Dungeon e nessun round è attivo
- **THEN** tutti i client ricevono la nuova identità e proiezione senza ricaricare

#### Scenario: Cambio in roll phase
- **WHEN** il Master cambia scena in Combattimento prima dell'avvio del round
- **THEN** il server attiva la scena e azzera tracker e riferimenti incompatibili prima del broadcast

#### Scenario: Round attivo
- **WHEN** il Master tenta il cambio mentre un round è attivo
- **THEN** il server rifiuta e tutti i client restano sulla scena corrente

#### Scenario: Adventurer
- **WHEN** un Adventurer tenta di attivare una scena
- **THEN** il server rifiuta per autorizzazione
