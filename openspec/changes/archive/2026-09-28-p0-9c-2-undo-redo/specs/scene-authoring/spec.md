## ADDED Requirements

### Requirement: P0.9c.2 Undo e redo limitati al disegno
Il sistema SHALL offrire al Master undo e redo delle operazioni di disegno, con cronologia limitata a 40 operazioni per scena e non persistita, senza includere altre mutazioni nel command/history model.

#### Scenario: Isolamento per scena
- **WHEN** il Master annulla o ripete sulla scena selezionata
- **THEN** cambia soltanto il layer drawing di quella scena

#### Scenario: Nuova operazione dopo undo
- **WHEN** il Master disegna o cancella dopo un undo
- **THEN** lo stack redo della scena viene svuotato

#### Scenario: Limite
- **WHEN** sono accettate più di 40 operazioni
- **THEN** le inverse più vecchie non sono più disponibili

#### Scenario: Riavvio
- **WHEN** il server viene riavviato
- **THEN** il drawing persistito rimane e la cronologia riparte vuota
