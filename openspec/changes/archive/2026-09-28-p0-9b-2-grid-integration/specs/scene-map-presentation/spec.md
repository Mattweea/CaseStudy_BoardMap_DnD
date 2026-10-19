## ADDED Requirements

### Requirement: P0.9b.2 Integrazione con la griglia esistente
La scena attiva SHALL fornire dimensioni e configurazione scene-specific alla griglia applicativa e al sistema esistente di movimento e misurazione, senza introdurre una seconda griglia, una seconda unità o nuove regole di costo.

#### Scenario: Configurazione della scena attiva
- **WHEN** diventa attiva una scena con configurazione valida
- **THEN** griglia, righello, sagome e movimento usano insieme i suoi valori

#### Scenario: Regole di movimento invariate
- **WHEN** un token pianifica o conferma un percorso
- **THEN** costi, diagonalità, budget e validazione restano governati dalla capability esistente
