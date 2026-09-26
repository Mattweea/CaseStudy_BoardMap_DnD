## ADDED Requirements

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

## MODIFIED Requirements

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
