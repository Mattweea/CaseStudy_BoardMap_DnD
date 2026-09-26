# token-movement-and-measurement Specification

## Purpose

Rendere il costo di un movimento visibile prima della conferma e corretto secondo le regole 5e dopo di essa, e dare al tavolo gli strumenti effimeri con cui si decide un movimento — righello, sagome di area e ping — senza che nessuno di essi possa alterare lo stato autorevole della partita.

## Requirements

### Requirement: Costo di percorso per segmento

Il costo di uno spostamento SHALL essere la somma dei costi dei singoli passi che compongono il percorso, non il massimo dello spostamento accumulato per asse. Un passo SHALL essere il movimento di una casella in una delle otto direzioni adiacenti; un segmento fra due punti SHALL essere decomposto nei passi diagonali necessari a coprire la differenza minore fra i due assi, seguiti dai passi ortogonali residui. Il costo del turno SHALL essere la somma dei costi dei percorsi compiuti nel turno.

Il costo SHALL essere calcolato da un modulo condiviso fra client e server, così che il valore mostrato prima della conferma e quello addebitato dopo siano prodotti dalla stessa funzione con gli stessi ingressi.

#### Scenario: Percorso spezzato

- **WHEN** un token con la regola standard percorre tre caselle verso destra e poi tre verso il basso
- **THEN** il costo è di sei caselle, non di tre

#### Scenario: Percorso diagonale puro

- **WHEN** un token con la regola standard percorre tre passi diagonali
- **THEN** il costo è di tre caselle, identico a quello addebitato prima di questa capability

#### Scenario: Accumulo nel turno

- **WHEN** un token compie nel proprio turno due spostamenti distinti da due e tre caselle
- **THEN** il movimento usato del turno risulta di cinque caselle

### Requirement: Regola delle diagonali scelta dal Master

La partita SHALL avere una regola delle diagonali con due soli valori: `standard`, in cui ogni passo diagonale costa una casella, e `alternating`, la variante 5-10-5, in cui i passi diagonali costano alternativamente una e due caselle. Il valore predefinito SHALL essere `standard`.

Il solo Master SHALL poter cambiare la regola; una richiesta di modifica da parte di un Adventurer SHALL essere rifiutata senza alcun effetto sullo stato. Il valore corrente SHALL essere distribuito a ogni partecipante autenticato e SHALL applicarsi immediatamente al righello, alla misura del trascinamento e alla validazione del movimento.

Con la regola `alternating`, l'alternanza SHALL essere contata per token e per turno: il primo passo diagonale del turno costa una casella, il secondo due, e così via. Il contatore SHALL essere azzerato negli stessi punti in cui è azzerato il movimento usato del turno e SHALL NOT attraversare il cambio di round.

#### Scenario: Variante 5-10-5 su tre diagonali

- **WHEN** la regola è `alternating` e un token compie tre passi diagonali nel proprio turno
- **THEN** il costo è di quattro caselle

#### Scenario: Alternanza attraverso due spostamenti dello stesso turno

- **WHEN** con la regola `alternating` un token compie un passo diagonale, si ferma, e poi ne compie un secondo nello stesso turno
- **THEN** il secondo passo costa due caselle, perché l'alternanza prosegue invece di ricominciare

#### Scenario: Modifica riservata al Master

- **WHEN** un Adventurer richiede di cambiare la regola delle diagonali
- **THEN** la richiesta è rifiutata, la regola resta quella corrente e nessun altro partecipante osserva un cambiamento

### Requirement: Unità di misura della partita

La partita SHALL avere un'unità di misura composta da un'etichetta e dal valore di una casella espresso in quell'unità. Il valore predefinito SHALL essere `1,5` con etichetta `m`. Il solo Master SHALL poter cambiare l'unità, e il valore per casella SHALL essere un numero positivo; un valore non positivo o non interpretabile come numero SHALL essere rifiutato senza modificare lo stato.

Ogni distanza mostrata all'utente — righello, misura del percorso pianificato, raggio e lunghezza delle sagome — SHALL essere espressa sia in caselle sia nell'unità della partita. Qualunque ulteriore unità mostrata accanto SHALL essere una conversione del valore appena misurato, mai una scala indipendente: l'unità scelta dal Master resta l'unico riferimento.

#### Scenario: Unità affiancata coerente con quella della partita

- **WHEN** il Master imposta una casella a `3 m` e il righello misura due caselle
- **THEN** l'eventuale misura affiancata in un'altra unità corrisponde a sei metri, non al valore che si otterrebbe con una scala per casella diversa da quella impostata

#### Scenario: Conversione della distanza

- **WHEN** l'unità è `1,5 m` per casella e il righello misura sei caselle
- **THEN** la misura mostrata è di sei caselle e nove metri

#### Scenario: Valore per casella non valido

- **WHEN** il Master invia un valore per casella pari a zero o negativo
- **THEN** la richiesta è rifiutata e l'unità corrente resta invariata

### Requirement: Righello indipendente dal movimento

Ogni partecipante autenticato SHALL poter misurare una distanza fra due punti qualsiasi della mappa con uno strumento righello, in qualunque momento, anche fuori dal proprio turno e anche a partire da token che non controlla. Il righello SHALL NOT spostare alcun token, SHALL NOT consumare budget di movimento e SHALL NOT modificare lo stato condiviso della partita.

Il righello SHALL accettare waypoint: ogni waypoint aggiunge un segmento al percorso, e la misura SHALL mostrare il costo di ogni segmento accanto al segmento stesso e il totale sulla punta del percorso, aggiornati mentre il puntatore si muove. Il righello SHALL chiudersi con `Esc` o con un comando esplicito di uscita, lasciando la mappa nello stato in cui era.

#### Scenario: Misura fuori turno

- **WHEN** un Adventurer usa il righello mentre è attivo il turno di un altro partecipante
- **THEN** la misura è mostrata e nessun token si sposta, né alcun budget di movimento cambia

#### Scenario: Percorso con waypoint

- **WHEN** un partecipante aggiunge due waypoint al righello
- **THEN** il percorso mostra tre segmenti con il costo di ciascuno e il totale del percorso

### Requirement: Pianificazione del movimento, uguale per ogni ruolo

La pianificazione di un movimento SHALL essere la stessa per il Master e per gli Adventurer: nessun ruolo SHALL disporre di un modo di muovere un token che non mostri il percorso misurato.

Durante la pianificazione il token SHALL restare disegnato nella posizione di partenza e il percorso SHALL mostrare il costo di ogni segmento, il costo totale e, quando il budget si applica secondo la modalità della sessione, il budget residuo del round. Il percorso SHALL accettare waypoint con le stesse interazioni del righello.

Durante un movimento il click primario su una casella SHALL avere un solo significato: aggiungere un punto al percorso. Il click su un token che si ha il diritto di muovere SHALL selezionarlo e aprire la pianificazione; ogni click successivo su una casella della mappa SHALL aggiungere un waypoint che spezza il percorso. Durante la pianificazione il click su un token SHALL NOT aggiungere un waypoint: sul token che si sta muovendo SHALL NOT avere effetto; su un altro token SHALL chiudere la pianificazione corrente senza inviare richieste e selezionare quel token, riaprendo la pianificazione da lì se si ha il diritto di muoverlo. Finché è aperta una pianificazione, il righello o una sagoma, i tasti di movimento da tastiera SHALL NOT muovere alcun token.

La destinazione SHALL NOT richiedere un click: SHALL essere la casella indicata dal puntatore nel momento della conferma. La conferma SHALL essere un comando di tastiera esplicito e SHALL NOT essere il rilascio di un pointer, così che nessun gesto di puntamento possa muovere un token da solo.

Un comando esplicito SHALL rimuovere l'ultimo waypoint senza annullare l'intero percorso. `Esc` e il click destro in qualunque punto della mappa, token compresi, SHALL annullare l'intera pianificazione. Il click destro che annulla SHALL NOT aggiungere un waypoint né aprire il menu del token cliccato.

L'interfaccia SHALL dichiarare in ogni momento, in forma testuale, quali gesti confermano, annullano e modificano il percorso in corso.

Prima della conferma l'interfaccia SHALL segnalare se la destinazione è fuori budget, se un segmento attraversa un ostacolo che blocca il movimento per quel token e se la destinazione è occupata da un'altra creatura. `Esc` e il click destro SHALL annullare lasciando il token nella posizione di partenza e senza inviare alcuna richiesta al server.

#### Scenario: Stesso gesto per Master e Adventurer

- **WHEN** il Master e un Adventurer muovono ciascuno un token che hanno il diritto di muovere
- **THEN** entrambi vedono il percorso misurato con lo stesso costo per segmento e lo stesso totale, e confermano con lo stesso gesto

#### Scenario: Movimento diretto senza click sulla destinazione

- **WHEN** un partecipante fa click sul proprio token, porta il puntatore sulla casella che gli interessa e dà il comando di conferma
- **THEN** il token si sposta su quella casella, senza che sia stato necessario cliccarla

#### Scenario: Percorso spezzato con un solo waypoint

- **WHEN** un partecipante fa click sul proprio token, fa click su una casella intermedia, porta il puntatore sulla casella finale e dà il comando di conferma
- **THEN** il token percorre entrambi i segmenti e il costo addebitato è quello dell'intero percorso spezzato

#### Scenario: Click su un token durante la pianificazione

- **WHEN** un partecipante sta pianificando il movimento del proprio token con un waypoint e fa click su un altro token
- **THEN** nessun waypoint viene aggiunto, nessuna richiesta di movimento è inviata e l'altro token risulta selezionato

#### Scenario: Frecce ignorate durante la pianificazione

- **WHEN** un partecipante ha aperto la pianificazione del proprio token, oppure il righello, e preme un tasto freccia
- **THEN** il token non si muove e nessuna richiesta di movimento è inviata

#### Scenario: Il rilascio del pointer non muove nulla

- **WHEN** un partecipante preme su un token che ha il diritto di muovere, sposta il puntatore su un'altra casella e rilascia
- **THEN** nessuna richiesta di movimento è inviata, il token resta nella posizione di partenza e la pianificazione resta aperta

#### Scenario: Annullamento con Esc

- **WHEN** un partecipante pianifica il movimento di un proprio token, aggiunge un waypoint e preme `Esc`
- **THEN** il token resta nella posizione di partenza, nessuna richiesta di movimento è inviata e il budget del turno non cambia

#### Scenario: Annullamento con il click destro

- **WHEN** un partecipante pianifica il movimento di un proprio token, aggiunge un waypoint e fa click destro su un token
- **THEN** la pianificazione si chiude, il token resta nella posizione di partenza, nessuna richiesta di movimento è inviata e il menu del token cliccato non si apre

#### Scenario: Avviso di budget insufficiente prima della conferma

- **WHEN** un Adventurer pianifica un percorso oltre il budget residuo in modalità Combattimento a round avviato
- **THEN** l'interfaccia segnala la condizione prima della conferma, in forma testuale e non con il solo colore

#### Scenario: Nessun budget in Esplorazione

- **WHEN** un Adventurer pianifica un percorso mentre la sessione è in Esplorazione
- **THEN** il percorso mostra costo di segmento e totale senza alcun budget residuo né avviso di budget

### Requirement: Motivo di un movimento rifiutato

Quando il server rifiuta un movimento, il partecipante che lo ha richiesto SHALL vederne il motivo, distinguendo almeno il budget insufficiente, l'ostacolo che blocca e la destinazione occupata. Il motivo SHALL restare visibile finché non viene chiuso, SHALL essere annunciato come avviso a chi usa una tecnologia assistiva e SHALL NOT essere scritto nello stato condiviso della partita: riguarda solo il client che ha inviato la richiesta.

#### Scenario: Rifiuto per budget

- **WHEN** un Adventurer conferma un percorso che supera il budget residuo e il server lo rifiuta
- **THEN** il token torna nella posizione di partenza e il partecipante legge che il movimento residuo non è sufficiente

### Requirement: Camminata condivisa di un movimento accettato

Dopo che un movimento è stato accettato, il percorso compiuto SHALL essere trasmesso ai partecipanti che già vedono quel token, così che ogni client mostri il token percorrere il tragitto invece di comparire direttamente a destinazione.

La camminata SHALL partire dall'accettazione del movimento, non dalla sua richiesta: un movimento rifiutato SHALL NOT produrre alcuna animazione, nemmeno sul client che lo ha richiesto. La trasmissione SHALL seguire le stesse regole di visibilità applicate allo stato della partita, SHALL NOT essere persistita, SHALL NOT modificare la versione dello stato e SHALL NOT comparire in alcuno snapshot.

#### Scenario: Movimento rifiutato senza animazione

- **WHEN** un Adventurer conferma un percorso che il server rifiuta
- **THEN** il token non percorre alcun tragitto e resta nella posizione di partenza

#### Scenario: Camminata vista da un altro client

- **WHEN** un partecipante muove un token lungo un percorso spezzato e la mossa è accettata
- **THEN** gli altri partecipanti che vedono quel token lo osservano percorrere lo stesso tragitto, e lo stato della partita non ne conserva traccia

### Requirement: Validazione server del percorso completo

La richiesta di movimento di un Adventurer SHALL trasmettere i waypoint del percorso, nell'ordine in cui sono stati scelti. Il server SHALL ricalcolare integralmente il costo del percorso con la regola delle diagonali corrente, SHALL verificare per ogni segmento gli ostacoli che bloccano il movimento e la sovrapposizione con altre creature, e SHALL verificare il budget residuo del turno. Il server SHALL ignorare qualunque costo, distanza o esito proposto dal client.

Una richiesta rifiutata SHALL lasciare il token nella posizione di partenza, SHALL NOT consumare budget e SHALL restituire un motivo comprensibile che distingue almeno il budget insufficiente, l'ostacolo che blocca e la destinazione occupata. Il server SHALL NOT applicare uno spostamento parziale lungo un percorso rifiutato.

Il server SHALL NOT calcolare un percorso al posto del richiedente: se il percorso trasmesso attraversa un ostacolo, la richiesta è rifiutata invece di essere corretta con una rotta alternativa.

#### Scenario: Costo dichiarato dal client ignorato

- **WHEN** un client invia un percorso dichiarando un costo inferiore a quello reale
- **THEN** il server addebita il costo che ha ricalcolato e rifiuta la richiesta se quel costo supera il budget residuo

#### Scenario: Ostacolo su un segmento intermedio

- **WHEN** un percorso ha la destinazione libera ma un segmento intermedio attraversa un ostacolo che blocca il movimento
- **THEN** la richiesta è rifiutata con il motivo dell'ostacolo e il token resta nella posizione di partenza

#### Scenario: Assenza di pathfinding automatico

- **WHEN** un percorso attraversa un ostacolo che potrebbe essere aggirato
- **THEN** il server rifiuta la richiesta e non propone né applica una rotta alternativa

#### Scenario: Movimento del Master

- **WHEN** il Master muove un token lungo un percorso che supererebbe il budget o attraverserebbe un ostacolo
- **THEN** il movimento è applicato, come già previsto per il ruolo, e la misura resta mostrata durante la pianificazione

### Requirement: Annullamento di un movimento con costo di percorso

L'annullamento di un movimento da parte del suo autore SHALL riportare il token nella posizione precedente e SHALL ripristinare il movimento usato del turno e lo stato dell'alternanza diagonale ai valori che avevano prima di quel movimento. Un partecipante SHALL NOT poter annullare il movimento di un altro.

#### Scenario: Ripristino dell'alternanza

- **WHEN** con la regola `alternating` un Adventurer annulla il proprio ultimo movimento
- **THEN** posizione, movimento usato e stato dell'alternanza tornano esattamente a quelli precedenti a quel movimento

### Requirement: Sagome effimere condivise

Ogni partecipante autenticato SHALL poter mostrare sulla mappa una sagoma di tipo cerchio, cono o linea, scegliendone origine, orientamento e dimensione, e SHALL leggerne la misura in caselle e nell'unità della partita. Il centro della sagoma — la casella da cui è originata — SHALL essere sempre evidenziato, per tutti e tre i tipi, in modo distinguibile dal riempimento dell'area. Mentre la sagoma è in corso di disegno, gli altri partecipanti autorizzati SHALL vederla comparire e cambiare in tempo reale.

La sagoma SHALL scomparire per tutti al rilascio o alla pressione di `Esc`. Una sagoma SHALL NOT essere scritta nello stato persistente della partita, SHALL NOT sopravvivere a un riavvio del server e SHALL NOT essere ritrovata da un client che si riconnette dopo la sua scomparsa. Una sagoma SHALL NOT modificare token, movimento, iniziativa o log dei tiri.

La distribuzione di una sagoma SHALL seguire le stesse regole di visibilità applicate allo stato della partita: una sagoma SHALL NOT rivelare a un destinatario una posizione o un elemento che quel destinatario non potrebbe già osservare.

#### Scenario: Centro sempre visibile

- **WHEN** un partecipante disegna un cerchio ampio o un cono
- **THEN** la casella di origine resta riconoscibile dentro l'area riempita, senza doverla dedurre dalla forma

#### Scenario: Sagoma vista da un altro client

- **WHEN** il Master disegna un cono con origine sul proprio token
- **THEN** gli altri partecipanti autorizzati lo vedono mentre viene disegnato e lo vedono scomparire al rilascio

#### Scenario: Nessuna traccia dopo la riconnessione

- **WHEN** un partecipante si riconnette dopo che una sagoma è scomparsa
- **THEN** non riceve alcuna sagoma e lo stato della partita non ne contiene traccia

### Requirement: Ping effimero senza controllo della visuale

Ogni partecipante autenticato SHALL poter lasciare un ping su un punto della mappa. Il ping SHALL essere visibile a tutti i partecipanti autorizzati per una durata breve e fissa, SHALL essere riconducibile al suo autore e SHALL scomparire da sé.

Il ping SHALL NOT spostare la visuale di alcun partecipante, incluso il Master: nessun ruolo SHALL disporre di un modo per centrare la camera di un altro partecipante. Il ping SHALL NOT essere persistito, SHALL NOT modificare lo stato della partita, e il suo autore SHALL essere l'utente autenticato della richiesta, mai un identificatore proposto dal client.

#### Scenario: Ping visibile a tutti

- **WHEN** un Adventurer lascia un ping sulla mappa
- **THEN** tutti i partecipanti autorizzati lo vedono comparire e scomparire, con l'indicazione del suo autore

#### Scenario: La visuale altrui non si sposta

- **WHEN** il Master lascia un ping mentre un Player guarda un'altra area della mappa
- **THEN** la visuale del Player resta dov'era

#### Scenario: Autore non falsificabile

- **WHEN** un client invia un ping dichiarando un autore diverso dall'utente della propria sessione
- **THEN** il ping è attribuito all'utente autenticato e l'attribuzione proposta dal client è ignorata

### Requirement: Compatibilità degli snapshot esistenti

Uno snapshot della partita salvato prima di questa capability SHALL caricarsi senza errori: la regola delle diagonali SHALL assumere il valore `standard`, l'unità SHALL assumere `1,5` con etichetta `m` e lo stato dell'alternanza diagonale SHALL essere assente o azzerato. Il movimento già consumato nel turno in corso SHALL essere conservato come numero di caselle usate, senza che il turno risulti invalidato o che il budget residuo diventi negativo.

#### Scenario: Snapshot privo dei nuovi campi

- **WHEN** il server carica uno snapshot salvato prima di questa capability, con un turno in corso e movimento già consumato
- **THEN** lo stato si installa con i valori predefiniti, il movimento consumato resta quello registrato e il partecipante può continuare a muovere entro il budget residuo

### Requirement: Budget di movimento legato alla modalità di sessione

Il budget di movimento dell'Adventurer SHALL applicarsi solo quando la sessione è in modalità Combattimento e il round è avviato; SHALL NOT dipendere dalla sola presenza di voci d'iniziativa. In Esplorazione il movimento dell'Adventurer SHALL essere privo di budget e SHALL NOT essere addebitato, mentre ostacoli e sovrapposizione restano verificati come sempre. Durante la fase di tiro dell'iniziativa il movimento dell'Adventurer SHALL essere libero e SHALL NOT essere addebitato, come in Esplorazione, così che il Master possa far disporre i personaggi prima del round 1. Il movimento del Master SHALL restare libero in ogni modalità. Entrare o uscire dal Combattimento SHALL azzerare movimento usato, alternanza diagonale, scatto e movimento extra di ogni token.

#### Scenario: Esplorazione senza budget

- **WHEN** in Esplorazione un Adventurer con velocità di 6 caselle muove il proprio token di 10 caselle senza attraversare ostacoli
- **THEN** il movimento è accettato e il movimento usato del token resta `0`

#### Scenario: Fase di tiro

- **WHEN** la sessione è in Combattimento, il round 1 non è ancora avviato e un Adventurer con velocità di 6 caselle muove il proprio token di 10 caselle
- **THEN** il movimento è accettato e il movimento usato del token resta `0`

#### Scenario: Round avviato

- **WHEN** a round avviato un Adventurer conferma un percorso che supera il budget residuo
- **THEN** il server rifiuta il movimento con il motivo del budget insufficiente, come già previsto

#### Scenario: Incontro in corso da snapshot legacy

- **WHEN** viene ripreso uno snapshot precedente che contiene voci d'iniziativa e un turno attivo
- **THEN** la sessione è in Combattimento a round avviato e il movimento già usato resta addebitato sul budget del round

### Requirement: Velocità ridotta dalle condizioni

La velocità di una creatura mossa da un Adventurer SHALL derivare dalle sue condizioni secondo il PHB 5e 2014, arrotondando per difetto ogni divisione. Le regole sono:

- **Velocità 0:** Afferrato, Trattenuto, Paralizzato, Pietrificato, Stordito, Privo di sensi o Indebolimento di livello 5 o superiore SHALL portare la velocità a 0. Con velocità 0 né lo scatto né il movimento extra SHALL aggiungere movimento, e il server SHALL rifiutare ogni movimento dell'Adventurer per quella creatura in qualunque modalità di sessione, con un motivo che nomina la condizione.
- **Velocità dimezzata:** Indebolimento dal livello 2 al livello 4 SHALL dimezzare la velocità base. Lo scatto SHALL raddoppiare la velocità dimezzata e il movimento extra SHALL sommarsi dopo.

Le condizioni del conducente SHALL NOT modificare il movimento di un veicolo. Il movimento del Master SHALL restare libero. La pianificazione SHALL mostrare il budget con la velocità effettiva e dichiarare in forma testuale la condizione che lo riduce. Client e server SHALL calcolare la velocità effettiva con la stessa funzione condivisa.

#### Scenario: Afferrato in Esplorazione

- **WHEN** in Esplorazione un Adventurer conferma un movimento del proprio token Afferrato
- **THEN** il server rifiuta il movimento con un motivo che cita Afferrato e il token resta fermo

#### Scenario: Scatto con velocità 0

- **WHEN** a round avviato un Adventurer Trattenuto usa lo scatto e prova a muovere
- **THEN** il budget resta 0 e il movimento viene rifiutato

#### Scenario: Indebolimento 2

- **WHEN** a round avviato un Adventurer con velocità di 5 caselle e Indebolimento 2 pianifica un movimento
- **THEN** il budget mostrato e verificato dal server è di 2 caselle, o di 4 dopo lo scatto

#### Scenario: Veicolo guidato da un personaggio Afferrato

- **WHEN** un Adventurer Afferrato muove il veicolo a cui è assegnato
- **THEN** il movimento del veicolo segue le regole già previste, senza la riduzione dovuta ad Afferrato

### Requirement: Alzarsi da prono

L'Adventurer SHALL poter togliere Prono ai propri token con il comando «Alzati». Il Master SHALL poterlo fare su qualunque token.

Costo e rifiuti dipendono dalla situazione:

- **A round avviato, Adventurer:** alzarsi SHALL costare metà della velocità effettiva, arrotondata per difetto, senza contare scatto e movimento extra. Il costo SHALL essere addebitato sul movimento usato del round. Il server SHALL rifiutare il comando se il movimento residuo è inferiore al costo, con un motivo che indica il costo e il residuo.
- **Velocità 0, qualunque modalità:** il server SHALL rifiutare il comando con un motivo che nomina la condizione.
- **Fase di tiro dell'iniziativa, Adventurer:** il comando SHALL essere rifiutato come ogni movimento.
- **Esplorazione:** alzarsi SHALL togliere Prono senza costo.
- **Master:** SHALL alzare un token senza costo in ogni modalità.

L'Adventurer SHALL poter annullare il proprio «Alzati», che ripristina Prono e restituisce il movimento addebitato.

#### Scenario: Alzarsi a round avviato

- **WHEN** a round avviato un Adventurer prono con velocità di 5 caselle e nessun movimento usato attiva «Alzati»
- **THEN** Prono viene tolto, il movimento usato diventa 2 e restano 3 caselle

#### Scenario: Movimento insufficiente

- **WHEN** a round avviato un Adventurer prono con velocità di 6 caselle ha già usato 4 caselle e attiva «Alzati»
- **THEN** il server rifiuta il comando indicando che servono 3 caselle e ne restano 2, e il token resta Prono

#### Scenario: Prono e Privo di sensi

- **WHEN** un Adventurer Privo di sensi e Prono attiva «Alzati»
- **THEN** il server rifiuta il comando citando Privo di sensi

#### Scenario: Esplorazione

- **WHEN** in Esplorazione un Adventurer prono attiva «Alzati»
- **THEN** Prono viene tolto e nessun movimento viene addebitato

### Requirement: Strisciare da prono

Quando un Adventurer muove una propria creatura che è Prono, ogni passo del percorso SHALL costare il doppio del costo previsto dalla regola delle diagonali. L'alternanza della variante 5-10-5 SHALL proseguire come per un movimento normale. La pianificazione SHALL mostrare il costo raddoppiato e dichiarare in forma testuale che il token sta strisciando, e il server SHALL addebitare lo stesso costo con la stessa funzione condivisa. Il raddoppio SHALL NOT applicarsi ai movimenti del Master né ai veicoli.

#### Scenario: Due caselle strisciando

- **WHEN** a round avviato un Adventurer prono muove il proprio token di due caselle in linea retta
- **THEN** il costo mostrato e addebitato è di 4 caselle

#### Scenario: Diagonali 5-10-5 strisciando

- **WHEN** con la variante 5-10-5 un Adventurer prono percorre due passi diagonali partendo dall'alternanza azzerata
- **THEN** il costo è di 6 caselle, cioè il doppio di 1 + 2

#### Scenario: Oltre il budget strisciando

- **WHEN** a round avviato un Adventurer prono con 3 caselle residue conferma un percorso di due caselle
- **THEN** il server rifiuta il movimento per budget insufficiente e il token resta fermo
