## ADDED Requirements

### Requirement: Barra della vita sul token

Un token con HP massimi numerici maggiori di 0 SHALL mostrare sotto di sé una barra non interattiva, distaccata di alcuni pixel dal bordo, con gli HP attuali in proporzione al massimo e gli HP temporanei positivi su una riga distinta, anch'essa proporzionata al massimo. Nello stato normale le righe SHALL essere sottili e prive di testo visibile; al passaggio del mouse sul token o al focus da tastiera SHALL espandersi e mostrare `attuali/massimi` e, quando presenti, `+N temp` dentro le rispettive righe. Sia nella scheda sia sul token, la riga degli attuali SHALL essere rossa sotto il 20% del massimo, gialla dal 20% al 50% incluso e verde sopra il 50%. La riga temporanea SHALL restare distinguibile quando gli HP attuali occupano tutta la larghezza. A 0 HP il riempimento della riga degli attuali SHALL essere vuoto e riconoscibile anche senza il colore. Il numero esatto SHALL essere sempre presente nel nome accessibile del token. Un token senza HP massimi SHALL NOT mostrare la barra.

Poiché gli HP arrivano solo al Master e al proprietario, il Master SHALL vedere la barra su ogni token che ha HP e un Adventurer solo sui propri token. Il testo `attuali/massimi` SHALL stare dentro la barra espansa, senza un'etichetta separata sul token.

#### Scenario: Barra del Master

- **WHEN** il Master guarda la mappa con un PG a 9 HP su 20 e un nemico a 3 HP su 10 senza puntare il mouse su di essi
- **THEN** vede sotto entrambi solo una riga sottile proporzionale, senza numeri che coprono i token vicini

#### Scenario: Dettaglio al passaggio del mouse

- **WHEN** il Master porta il mouse su un token con HP
- **THEN** la barra di quel token si espande sopra gli altri elementi e mostra il numero esatto al suo interno; uscendo dal token torna sottile

#### Scenario: Barra del Player

- **WHEN** un Adventurer guarda la mappa e porta il mouse sul proprio token
- **THEN** vede il dettaglio PF del proprio token e nessuna barra per i token altrui o nemici

#### Scenario: HP temporanei con attuali pieni

- **WHEN** un PG ha 40 HP massimi, 40 attuali e 6 temporanei
- **THEN** l'indicatore della scheda resta pieno, mentre sul token le righe sottili indicano attuali e temporanei e l'espansione mostra `40/40` e `+6 temp`

#### Scenario: Soglie dei colori

- **WHEN** gli HP attuali sono 19, 20, 50 o 51 su 100 massimi
- **THEN** la riga degli attuali è rispettivamente rossa, gialla, gialla e verde, sia nella scheda sia sul token

#### Scenario: Numero da tastiera

- **WHEN** un Adventurer porta il focus da tastiera sul proprio token
- **THEN** la barra si espande con i numeri esatti e il nome accessibile del token li elenca

#### Scenario: Token senza HP massimi

- **WHEN** il Master guarda un oggetto senza HP massimi
- **THEN** il token non mostra alcuna barra
