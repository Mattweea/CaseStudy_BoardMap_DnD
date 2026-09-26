## ADDED Requirements

### Requirement: P0.9d.2 Isolamento dei Player sulla scena attiva
Il sistema SHALL accettare dai Player soltanto operazioni riferite alla scena attiva e SHALL omettere dalle loro viste catalogo, documenti e asset delle scene inattive, applicando la sanitizzazione già prevista dall'architettura corrente.

#### Scenario: Mutazione inattiva
- **WHEN** un Player invia una mutazione per una scena non attiva o una versione precedente
- **THEN** il server la rifiuta senza modificare alcuna scena

#### Scenario: Cambio con interazione in corso
- **WHEN** il client riceve un activeSceneId differente
- **THEN** azzera camera, selezione, percorso, righello, sagoma, ping e code effimere precedenti

#### Scenario: Contenuti inattivi
- **WHEN** il server produce una vista Player
- **THEN** catalogo, documenti e asset delle scene inattive sono omessi

#### Scenario: Confine P0.10
- **WHEN** il Player riceve la proiezione sanitizzata della scena attiva
- **THEN** P0.9d.2 non garantisce il filtraggio completo di ogni segreto o dato oltre il fog
