## MODIFIED Requirements

### Requirement: Dadi multipli e percentile leggibili

La presentazione SHALL includere tutti i dadi autorevoli di una voce entro il limite supportato e SHALL rispettare i gruppi logici del tiro. Un d100 logico SHALL essere rappresentato mediante due modelli percentile coordinati la cui lettura corrisponde al valore `1..100`, compresi `100`, i multipli di dieci e i valori inferiori a dieci, senza aggiungere dadi al contratto autorevole. Al termine del tiro, i dadi di una stessa voce SHALL restare fermi sulla mappa con pari enfasi, senza che la presentazione indichi quale esito debba contare. La presentazione SHALL NOT sovrapporre alla mappa un riepilogo testuale del risultato: la lettura del tiro, gruppi compresi, SHALL restare affidata al log dei dadi.

#### Scenario: Coppia non risolta

- **WHEN** un tiro contiene due d20 entrambi `unresolved`
- **THEN** entrambi rotolano e restano presentati con pari enfasi, senza inventare una scelta del server

#### Scenario: Voce storica con esito scartato

- **WHEN** la presentazione riceve una voce registrata prima del cambiamento, con un d20 `kept` e uno `discarded`
- **THEN** entrambi rotolano sul proprio valore e restano presentati con pari enfasi, senza errori e senza attenuare alcun dado

#### Scenario: Casi limite percentile

- **WHEN** il log contiene un d100 con valore `7`, `40` oppure `100`
- **THEN** la coppia percentile mostra rispettivamente `07`, `40` oppure `00` interpretato come `100`

#### Scenario: Danno con più gruppi

- **WHEN** un tiro di danno contiene dadi appartenenti a due gruppi logici
- **THEN** tutti i dadi rotolano nella stessa presentazione, nessun riepilogo compare sulla mappa e il log mostra distinti i due gruppi

### Requirement: Interruzione immediata della presentazione

Durante una presentazione 3D attiva il partecipante SHALL poter terminare immediatamente il tiro corrente premendo `Esc` oppure effettuando un click primario. L'interruzione SHALL ripulire la scena e l'eventuale attesa a dadi fermi senza modificare il log o il risultato autorevole, SHALL NOT impedire l'azione normalmente associata al click o al tasto e SHALL consentire alla coda di proseguire con il tiro successivo.

#### Scenario: Salto con Escape durante il tiro

- **WHEN** un dado sta rotolando e il partecipante preme `Esc`
- **THEN** la presentazione corrente termina subito, il risultato numerico resta invariato e l'eventuale tiro successivo può iniziare

#### Scenario: Click non bloccante durante il tiro

- **WHEN** un dado sta rotolando e il partecipante effettua un click primario su un controllo utilizzabile dell'applicazione
- **THEN** la presentazione corrente termina senza annullare né ritardare l'azione richiesta su quel controllo

#### Scenario: Salto durante il riepilogo finale

- **WHEN** i dadi sono fermi e ancora visibili sulla mappa
- **THEN** `Esc` o un click primario chiude subito la presentazione e libera la coda
