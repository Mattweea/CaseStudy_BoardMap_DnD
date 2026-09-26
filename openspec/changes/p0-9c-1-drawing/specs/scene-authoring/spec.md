## ADDED Requirements

### Requirement: P0.9c.1 Disegno separato da elementi e token
Il sistema SHALL consentire al Master di aggiungere tratti con la matita e rimuoverli con la gomma, conservando i disegni in un layer persistente distinto dagli elementi scenici e dai token.

#### Scenario: Tratto confermato
- **WHEN** il Master conclude un gesto valido
- **THEN** il client invia una sola operazione versionata e il tratto viene distribuito

#### Scenario: Gomma selettiva
- **WHEN** il Master usa la gomma su uno o più tratti
- **THEN** vengono rimossi soltanto i tratti identificati, non elementi o token sovrapposti

#### Scenario: Player
- **WHEN** un Player visualizza la scena
- **THEN** vede i disegni confermati ma non può inviare operazioni drawing
