## ADDED Requirements

### Requirement: Controllo rapido della luce della scena attiva

Il Master SHALL poter alternare buio e luce completa della scena attiva dalla board normale e fullscreen. La modifica SHALL usare la versione corrente del documento scena, SHALL persistere per quella scena e SHALL aggiornare la proiezione condivisa dopo la conferma. Un conflitto SHALL lasciare invariata la luce confermata. Il controllo SHALL essere assente per i Player.

#### Scenario: Luce isolata per scena

- **WHEN** il Master illumina la scena attiva e passa a una scena ancora buia
- **THEN** la nuova scena rimane buia e la scena precedente conserva la luce completa

#### Scenario: Errore o conflitto

- **WHEN** la modifica della scena è rifiutata o fallisce
- **THEN** il pulsante continua a riflettere la configurazione confermata
