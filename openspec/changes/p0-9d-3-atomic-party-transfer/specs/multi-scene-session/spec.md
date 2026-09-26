## ADDED Requirements

### Requirement: P0.9d.3 Trasferimento atomico del party
Il sistema SHALL permettere al Master di trasferire come singola operazione il party calcolato dal server da una scena sorgente alla scena attiva, preservando identificatori e relazioni supportate oppure lasciando entrambe le scene invariate.

#### Scenario: Preview
- **WHEN** il Master sceglie sorgente e cella ancora
- **THEN** il server calcola un layout deterministico valido senza modificare le scene

#### Scenario: Commit
- **WHEN** il Master conferma e tutti i footprint trovano spazio
- **THEN** roster token, familiari posseduti e veicoli occupati sono trasferiti in un unico commit logico

#### Scenario: Fallimento
- **WHEN** versioni, spazio, round o persistenza impediscono il trasferimento
- **THEN** nessuna entità viene trasferita parzialmente

#### Scenario: Identità
- **WHEN** il party viene trasferito
- **THEN** ID, ownership e relazioni veicolo/familiare supportate sono preservati
