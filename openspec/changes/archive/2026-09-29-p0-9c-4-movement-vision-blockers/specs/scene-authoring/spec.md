## ADDED Requirements

### Requirement: P0.9c.4 Blocchi di movimento e visuale senza anticipare P0.10
Il sistema SHALL permettere al Master di configurare separatamente per un elemento il blocco del movimento e il blocco della visuale e SHALL integrare il footprint con gli helper esistenti.

#### Scenario: Movimento
- **WHEN** un percorso attraversa un footprint blocksMovement
- **THEN** la validazione server esistente rifiuta il segmento secondo le regole correnti

#### Scenario: Visuale
- **WHEN** il calcolo corrente incontra un footprint blocksVision
- **THEN** il client applica il comportamento di visibilità esistente

#### Scenario: Flag indipendenti
- **WHEN** soltanto uno dei due flag è attivo
- **THEN** l'elemento influisce soltanto sul relativo sistema

#### Scenario: Confine P0.10
- **WHEN** un elemento limita la visuale del Player
- **THEN** P0.9c.4 non garantisce che ogni informazione oltre il blocco sia assente dal payload
