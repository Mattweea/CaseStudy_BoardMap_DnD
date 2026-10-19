## MODIFIED Requirements

### Requirement: Unità di misura della partita

Ogni scena SHALL avere un'unità di misura composta da un'etichetta e dal valore di una casella espresso in quell'unità. Il valore predefinito SHALL essere 1,5 con etichetta m. Il solo Master SHALL poter cambiare l'unità della scena, e il valore per casella SHALL essere un numero positivo; un valore non positivo o non interpretabile come numero SHALL essere rifiutato senza modificare lo stato. La scena attiva SHALL essere l'unica sorgente dell'unità usata dal sistema esistente di movimento e misurazione.

Ogni distanza mostrata all'utente — righello, misura del percorso pianificato, raggio e lunghezza delle sagome — SHALL essere espressa sia in caselle sia nell'unità della scena attiva. Qualunque ulteriore unità mostrata accanto SHALL essere una conversione del valore appena misurato, mai una scala indipendente: l'unità scelta dal Master per la scena attiva resta l'unico riferimento.

#### Scenario: Unità affiancata coerente con quella della partita

- **WHEN** il Master imposta una casella della scena attiva a 3 m e il righello misura due caselle
- **THEN** l'eventuale misura affiancata in un'altra unità corrisponde a sei metri, non al valore che si otterrebbe con una scala per casella diversa da quella impostata

#### Scenario: Conversione della distanza

- **WHEN** l'unità della scena attiva è 1,5 m per casella e il righello misura sei caselle
- **THEN** la misura mostrata è di sei caselle e nove metri

#### Scenario: Valore per casella non valido

- **WHEN** il Master invia un valore per casella pari a zero o negativo
- **THEN** la richiesta è rifiutata e l'unità della scena resta invariata

#### Scenario: Cambio atomico dell'unità con la scena

- **WHEN** il server attiva una scena che usa 5 ft per casella
- **THEN** righello, percorso e sagome passano insieme a 5 ft per casella senza conservare la scala precedente
