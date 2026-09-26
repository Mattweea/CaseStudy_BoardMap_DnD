## ADDED Requirements

### Requirement: P0.9a.1 Modello di scena versionato e normalizzato
Il sistema SHALL rappresentare ogni scena con identificatore stabile, metadati, versione e documento JSON normalizzato, mantenendo sezioni distinte per background, configurazione board, disegni, elementi scenici, placement preparati, token runtime e riferimenti ad altre entità.

#### Scenario: Documento valido
- **WHEN** il server carica o riceve un documento scena valido
- **THEN** applica default e limiti canonici senza fondere disegni, elementi, placement e token

#### Scenario: Documento malformato
- **WHEN** un documento contiene identificatori duplicati, riferimenti invalidi, coordinate fuori limite o supera le soglie ammesse
- **THEN** il server lo rifiuta senza modificare stato o versione

#### Scenario: Confine configurazione e runtime
- **WHEN** durante il gioco cambiano movimento, HP, turno o round
- **THEN** P0.9a.1 non promuove automaticamente tali valori nella configurazione persistente né ne promette il recovery dopo riavvio
