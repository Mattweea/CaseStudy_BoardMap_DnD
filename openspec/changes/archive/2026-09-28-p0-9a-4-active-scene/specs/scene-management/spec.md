## ADDED Requirements

### Requirement: P0.9a.4 Una sola scena attiva integrata con la board
Il sistema SHALL mantenere per la campagna una sola scena attiva e SHALL proiettarne configurazione e contenuti nella board e nello stato realtime corrente.

#### Scenario: Snapshot Player
- **WHEN** il server produce una vista HTTP o SSE per un Player
- **THEN** include soltanto identità e proiezione della scena attiva
- **AND** omette catalogo, documenti e asset delle scene inattive

#### Scenario: Snapshot Master
- **WHEN** il server produce una vista per il Master
- **THEN** include il catalogo autorizzato e la proiezione attiva senza incorporare tutti i documenti completi

#### Scenario: Compatibilità della board
- **WHEN** un consumer esistente legge token, luci, unità o flag board
- **THEN** riceve i valori derivati dalla scena attiva nella forma compatibile prevista dagli adapter
