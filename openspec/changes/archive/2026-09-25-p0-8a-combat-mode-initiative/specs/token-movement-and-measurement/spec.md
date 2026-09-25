## MODIFIED Requirements

### Requirement: Pianificazione del movimento, uguale per ogni ruolo

La pianificazione di un movimento SHALL essere la stessa per il Master e per gli Adventurer: nessun ruolo SHALL disporre di un modo di muovere un token che non mostri il percorso misurato.

Durante la pianificazione il token SHALL restare disegnato nella posizione di partenza e il percorso SHALL mostrare il costo di ogni segmento, il costo totale e, quando il budget si applica secondo la modalità della sessione, il budget residuo del round. Il percorso SHALL accettare waypoint con le stesse interazioni del righello.

Durante un movimento il click su una casella SHALL avere un solo significato: aggiungere un punto al percorso. Il click su un token che si ha il diritto di muovere SHALL selezionarlo e aprire la pianificazione; ogni click successivo su una casella della mappa SHALL aggiungere un waypoint che spezza il percorso. Durante la pianificazione il click su un token SHALL NOT aggiungere un waypoint: sul token che si sta muovendo SHALL NOT avere effetto; su un altro token SHALL chiudere la pianificazione corrente senza inviare richieste e selezionare quel token, riaprendo la pianificazione da lì se si ha il diritto di muoverlo. Finché è aperta una pianificazione, il righello o una sagoma, i tasti di movimento da tastiera SHALL NOT muovere alcun token.

La destinazione SHALL NOT richiedere un click: SHALL essere la casella indicata dal puntatore nel momento della conferma. La conferma SHALL essere un comando di tastiera esplicito e SHALL NOT essere il rilascio di un pointer, così che nessun gesto di puntamento possa muovere un token da solo.

Un comando esplicito SHALL rimuovere l'ultimo waypoint senza annullare l'intero percorso, e `Esc` SHALL annullare l'intera pianificazione.

L'interfaccia SHALL dichiarare in ogni momento, in forma testuale, quali gesti confermano, annullano e modificano il percorso in corso.

Prima della conferma l'interfaccia SHALL segnalare se la destinazione è fuori budget, se un segmento attraversa un ostacolo che blocca il movimento per quel token e se la destinazione è occupata da un'altra creatura. `Esc` SHALL annullare lasciando il token nella posizione di partenza e senza inviare alcuna richiesta al server.

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

#### Scenario: Avviso di budget insufficiente prima della conferma

- **WHEN** un Adventurer pianifica un percorso oltre il budget residuo in modalità Combattimento a round avviato
- **THEN** l'interfaccia segnala la condizione prima della conferma, in forma testuale e non con il solo colore

#### Scenario: Nessun budget in Esplorazione

- **WHEN** un Adventurer pianifica un percorso mentre la sessione è in Esplorazione
- **THEN** il percorso mostra costo di segmento e totale senza alcun budget residuo né avviso di budget

## ADDED Requirements

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
