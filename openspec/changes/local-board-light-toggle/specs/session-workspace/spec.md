## ADDED Requirements

### Requirement: Controllo rapido della luce completa sulla board

La board SHALL mostrare al Master, nella vista normale e fullscreen, un toggle con icona luna/sole che rappresenta lo stato corrente della luce completa dei Player. Il toggle SHALL avere un nome accessibile che descrive l'azione disponibile e SHALL alternare buio e luce completa tramite il documento versionato della scena attiva. Un Player SHALL NOT vedere o azionare il toggle. La luce completa SHALL mantenere le regole esistenti per i token invisibili e SHALL NOT rimuovere le luci puntuali salvate.

#### Scenario: Il Master illumina e riattiva il buio

- **WHEN** il Master attiva il toggle con luna e poi quello con sole
- **THEN** tutti i Player vedono prima la scena attiva illuminata e poi tornano a vedere soltanto le aree consentite da scurovisione e luci puntuali; l'icona e il nome del comando seguono lo stato confermato

#### Scenario: Controllo disponibile in fullscreen

- **WHEN** il Master apre la board fullscreen
- **THEN** il toggle rimane disponibile e mostra lo stesso stato della board normale

#### Scenario: Player senza controllo della luce completa

- **WHEN** un Player apre la board
- **THEN** non trova il toggle e non acquisisce il permesso di cambiare la luce completa

#### Scenario: Cambio scena

- **WHEN** il Master illumina una scena e poi attiva una scena con il buio configurato
- **THEN** il pulsante e i Player vedono il buio della nuova scena, mentre la prima conserva la propria configurazione

#### Scenario: Conflitto della versione

- **WHEN** il Master aziona il toggle con una versione della scena obsoleta
- **THEN** il server rifiuta la scrittura e il pulsante continua a mostrare lo stato confermato
