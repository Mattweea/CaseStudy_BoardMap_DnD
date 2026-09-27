## Purpose

Gestire gli HP di un personaggio durante la partita come in Roll20: chi gioca scrive un danno o una cura e il sistema applica solo l'aritmetica del PHB 5e 2014 fra HP attuali e temporanei, la transizione a e da 0 HP e la riservatezza degli HP verso gli altri Player, senza automatizzare attacchi, cure o regole di morte.

## Requirements

### Requirement: Danno e cura con ±N

Il campo degli HP attuali della scheda e il campo dei punti ferita del menu radiale del token SHALL accettare, oltre a un valore assoluto, un danno `-N` o una cura `+N`, con N intero da 1 a 999 e spazi ammessi fra segno e numero. Il valore SHALL essere inviato solo alla conferma esplicita del campo (`Invio`, o l'uscita dal campo nella scheda), mai durante la digitazione. Il campo SHALL accettare anche un valore vuoto o un intero assoluto non negativo, applicati come valore scritto a mano. Un input diverso da questi e da un `±N` valido, per esempio `2d6`, `-0` o `-1000`, SHALL essere rifiutato con un messaggio vicino al campo, senza modificare la scheda. Solo il proprietario della scheda e il Master SHALL poter applicare `±N`; ogni altro utente SHALL ricevere un rifiuto di autorizzazione. Dal menu radiale il campo SHALL essere disponibile tramite un comando con icona solo sul token canonico di un personaggio con una scheda collegata; un famiglio, un nemico, un oggetto o un veicolo SHALL NOT offrirlo, e una richiesta per uno di questi token SHALL essere rifiutata. Il menu SHALL NOT duplicare la barra proporzionale degli HP attorno alla corona. Le due superfici SHALL applicare le stesse regole e mostrare lo stesso risultato: una modifica fatta da una SHALL comparire nell'altra senza ricaricare la pagina. Gli HP temporanei e massimi SHALL restare modificabili solo nella scheda.

#### Scenario: Danno scritto nel campo

- **WHEN** il proprietario scrive `-8` nel campo degli HP attuali e preme `Invio`
- **THEN** la scheda applica il danno e il campo mostra il nuovo valore

#### Scenario: Nessun invio durante la digitazione

- **WHEN** il proprietario scrive `-` e poi `8` senza confermare
- **THEN** nessuna modifica raggiunge il server finché il campo non viene confermato

#### Scenario: Input non valido

- **WHEN** il proprietario conferma `2d6` nel campo degli HP attuali
- **THEN** la scheda non cambia, il campo torna al valore precedente e compare un messaggio che indica la sintassi ammessa

#### Scenario: Danno dal menu del token

- **WHEN** il Master apre il menu radiale del token di un PG con 12 HP attuali e 5 temporanei, scrive `-8` nel campo dei punti ferita e preme `Invio`
- **THEN** il PG ha 9 HP attuali e 0 temporanei, e la scheda aperta dal proprietario mostra gli stessi valori senza ricaricare

#### Scenario: Token senza scheda

- **WHEN** un client chiede di applicare `-3` al famiglio di un Adventurer o a un nemico
- **THEN** la richiesta viene rifiutata e gli HP del token non cambiano

#### Scenario: Altro Player

- **WHEN** un Adventurer prova ad applicare `-5` alla scheda di un altro personaggio
- **THEN** la richiesta viene rifiutata come non autorizzata e gli HP non cambiano

### Requirement: Aritmetica PHB degli HP

Il sistema SHALL calcolare `±N` sul server, a partire dai valori correnti della scheda al momento della richiesta e non da valori proposti dal client:

- **danno `-N`:** gli HP temporanei SHALL assorbire per primi fino al loro valore; il resto SHALL ridurre gli HP attuali fino a un minimo di 0, e l'eccedenza oltre 0 SHALL essere ignorata;
- **cura `+N`:** gli HP attuali SHALL aumentare fino al massimo, senza errore quando la cura lo supererebbe; gli HP temporanei SHALL NOT cambiare.

Una cura su una scheda senza HP massimi numerici SHALL essere rifiutata con un messaggio che chiede di impostarli; un `±N` su una scheda senza HP attuali numerici SHALL essere rifiutato allo stesso modo. Gli HP temporanei SHALL restare un valore assoluto impostato a mano, che `±N` modifica solo nel caso del danno. Due richieste `±N` quasi simultanee sulla stessa scheda SHALL essere applicate entrambe, una dopo l'altra, senza che una sovrascriva l'altra. Ogni richiesta accettata SHALL aggiornare nello stesso momento la scheda e il token collegato.

#### Scenario: Danno che attraversa i temporanei

- **WHEN** un PG con 12 HP attuali, 5 temporanei e 20 massimi riceve `-8`
- **THEN** ha 9 HP attuali e 0 temporanei

#### Scenario: Danno assorbito dai temporanei

- **WHEN** un PG con 12 HP attuali e 5 temporanei riceve `-3`
- **THEN** ha 12 HP attuali e 2 temporanei

#### Scenario: Danno oltre lo zero

- **WHEN** un PG con 12 HP attuali e 0 temporanei riceve `-30`
- **THEN** ha 0 HP attuali e nessun altro effetto dovuto all'eccedenza

#### Scenario: Temporanei a zero HP

- **WHEN** un PG con 0 HP attuali e 4 temporanei riceve `-3`
- **THEN** ha 0 HP attuali e 1 temporaneo

#### Scenario: Cura oltre il massimo

- **WHEN** un PG con 18 HP attuali, 5 temporanei e 20 massimi riceve `+10`
- **THEN** ha 20 HP attuali e 5 temporanei, senza alcun messaggio di errore

#### Scenario: Cura senza massimo

- **WHEN** il proprietario applica `+5` a una scheda senza HP massimi numerici
- **THEN** la richiesta viene rifiutata con un messaggio che chiede di impostare gli HP massimi e la scheda non cambia

#### Scenario: Due danni quasi simultanei

- **WHEN** il proprietario e il Master applicano ciascuno `-5` a un PG con 12 HP attuali e 0 temporanei, quasi nello stesso momento
- **THEN** il PG ha 2 HP attuali

### Requirement: Transizioni a e da zero HP

Quando gli HP attuali di un PG passano da un valore maggiore di 0 a 0, per `-N` o per un valore assoluto scritto nella scheda, il token canonico del PG SHALL ricevere Privo di sensi, e quindi Prono secondo le regole delle condizioni. Quando gli HP attuali passano da 0 a un valore maggiore di 0, per `+N` o per un valore assoluto, il token SHALL perdere Privo di sensi e conservare Prono, e la scheda SHALL azzerare successi e fallimenti contro morte nella stessa modifica. Un valore che resta a 0 o resta sopra 0 SHALL NOT cambiare condizioni né contatori.

Il sistema SHALL NOT avviare tiri salvezza contro morte, applicare la morte istantanea da danno massiccio né considerare resistenze, vulnerabilità o immunità. Le condizioni restano modificabili a mano dal menu radiale anche a 0 HP.

#### Scenario: Scendere a zero

- **WHEN** un PG in piedi con 3 HP attuali riceve `-5`
- **THEN** ha 0 HP attuali e il suo token è Privo di sensi e Prono

#### Scenario: Zero scritto a mano

- **WHEN** il Master scrive `0` come valore assoluto negli HP attuali di un PG con 7 HP
- **THEN** il token del PG diventa Privo di sensi e Prono

#### Scenario: Risalire da zero

- **WHEN** un PG a 0 HP, Privo di sensi e Prono, con 2 successi e 1 fallimento contro morte, riceve `+1`
- **THEN** ha 1 HP attuale, il token non è più Privo di sensi ma resta Prono, e i contatori contro morte sono a 0

#### Scenario: Danno a chi è già a zero

- **WHEN** un PG a 0 HP con 1 fallimento contro morte riceve `-4`
- **THEN** resta a 0 HP, le sue condizioni non cambiano e il contatore dei fallimenti resta 1

### Requirement: Riservatezza degli HP

Gli HP attuali, massimi e temporanei di un token SHALL raggiungere solo il Master e il proprietario del token, famiglio compreso. Il server SHALL rimuoverli da ogni stato consegnato a un altro Adventurer, via HTTP e via SSE, così che non siano leggibili nemmeno nei dati ricevuti. La scheda di un personaggio resta riservata al proprietario e al Master, come già stabilito.

Per il token canonico di un PG, gli HP SHALL essere sempre quelli della scheda: il server SHALL ignorare i valori HP inviati da un client in qualunque scrittura della mappa, compreso il commit a stato pieno del Master, e l'aggiornamento di un token proprio SHALL NOT accettare campi HP.

#### Scenario: HP di un altro PG

- **WHEN** un Adventurer riceve lo stato della mappa
- **THEN** i token degli altri personaggi e dei nemici non contengono HP attuali, massimi né temporanei

#### Scenario: HP del proprio token

- **WHEN** un Adventurer riceve lo stato della mappa
- **THEN** il proprio token e il proprio famiglio contengono i propri HP

#### Scenario: HP inviati dal token

- **WHEN** un Adventurer invia l'aggiornamento del proprio token con HP attuali diversi da quelli della scheda
- **THEN** gli HP del token restano quelli della scheda

#### Scenario: Commit del Master con HP diversi dalla scheda

- **WHEN** il Master invia un commit a stato pieno in cui il token di un PG ha HP diversi da quelli della scheda
- **THEN** il token del PG conserva gli HP della scheda, mentre gli HP dei nemici inviati dal Master restano quelli inviati

### Requirement: Barra della vita sul token

Un token con HP massimi numerici maggiori di 0 SHALL mostrare sotto di sé una barra non interattiva, distaccata di alcuni pixel dal bordo, con gli HP attuali in proporzione al massimo e gli HP temporanei su una riga distinta, anch'essa proporzionata al massimo. Sia nella scheda sia sul token, la riga degli attuali SHALL essere rossa sotto il 20% del massimo, gialla dal 20% al 50% incluso e verde sopra il 50%. La riga temporanea SHALL restare visibile anche quando gli HP attuali occupano tutta la larghezza della barra. A 0 HP il riempimento della riga degli attuali SHALL essere vuoto e riconoscibile anche senza il colore. Il numero esatto `attuali/massimi` SHALL restare visibile dentro la riga degli attuali; i temporanei positivi SHALL mostrare `+N temp` dentro la loro riga. Il numero esatto SHALL essere sempre presente anche nel nome accessibile del token. Un token senza HP massimi SHALL NOT mostrare la barra.

Poiché gli HP arrivano solo al Master e al proprietario, il Master SHALL vedere la barra su ogni token che ha HP e un Adventurer solo sui propri token. Il testo `attuali/massimi` SHALL stare dentro la barra, senza un'etichetta separata sul token.

#### Scenario: Barra del Master

- **WHEN** il Master guarda la mappa con un PG a 9 HP su 20 e un nemico a 3 HP su 10
- **THEN** vede una barra sotto entrambi i token e legge sempre il numero esatto al suo interno

#### Scenario: Barra del Player

- **WHEN** un Adventurer guarda la mappa
- **THEN** vede la barra sotto il proprio token e non sotto quelli degli altri personaggi o dei nemici

#### Scenario: HP temporanei con attuali pieni

- **WHEN** un PG ha 40 HP massimi, 40 attuali e 6 temporanei
- **THEN** l'indicatore della scheda e la barra sotto il token mostrano gli attuali pieni e una riga distinta per i 6 temporanei; il token mostra `40/40` e `+6 temp`

#### Scenario: Soglie dei colori

- **WHEN** gli HP attuali sono 19, 20, 50 o 51 su 100 massimi
- **THEN** la riga degli attuali è rispettivamente rossa, gialla, gialla e verde, sia nella scheda sia sul token

#### Scenario: Numero da tastiera

- **WHEN** un Adventurer porta il fuoco da tastiera sul proprio token
- **THEN** il numero esatto degli HP è già dentro la barra e il nome accessibile del token li elenca

#### Scenario: Token senza HP massimi

- **WHEN** il Master guarda un oggetto senza HP massimi
- **THEN** il token non mostra alcuna barra
