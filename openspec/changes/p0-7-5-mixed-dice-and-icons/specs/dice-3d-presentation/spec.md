## REMOVED Requirements

### Requirement: Dadi multipli, percentile e disposizione leggibile

**Reason**: Il requisito distingue la resa dei dadi `kept` da quella dei `discarded`, ma `discarded` nasce soltanto quando il server risolve vantaggio o svantaggio, e quella risoluzione richiede che il client dichiari una modalità. Tolto il selettore di modalità dal tiro libero, nessun tiro nuovo può più produrre un dado scartato: il tiro d'iniziativa non lo produce nemmeno oggi, perché calcola un valore lato client senza creare una voce di log. Il requisito resterebbe vero soltanto per le voci già registrate, promettendo a chi legge la specifica un comportamento che il prodotto non genera più.

**Migration**: Sostituito dal requisito «Dadi multipli e percentile leggibili», che conserva invariati il limite di presentazione, i gruppi logici, la rappresentazione percentile e la parità degli `unresolved`, e smette di richiedere una resa differenziata fra tenuti e scartati. Le voci storiche con vantaggio o svantaggio restano leggibili e presentano i propri dadi con pari enfasi: si perde l'indicazione visiva di quale esito fu tenuto, mentre il campo `disposition` resta nel dato e permette di ripristinare la distinzione in futuro senza migrazione.

## ADDED Requirements

### Requirement: Dadi multipli e percentile leggibili

La presentazione SHALL includere tutti i dadi autorevoli di una voce entro il limite supportato e SHALL mantenere riconoscibili i gruppi logici. Un d100 logico SHALL essere rappresentato mediante due modelli percentile coordinati la cui lettura corrisponde al valore `1..100`, compresi `100`, i multipli di dieci e i valori inferiori a dieci, senza aggiungere dadi al contratto autorevole. Al termine del tiro, i dadi di una stessa voce SHALL essere presentati con pari enfasi, senza che la presentazione indichi quale esito debba contare.

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
- **THEN** tutti i dadi rotolano nella stessa presentazione e il riepilogo finale conserva distinguibili i due gruppi
