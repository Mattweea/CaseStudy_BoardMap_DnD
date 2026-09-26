## MODIFIED Requirements

### Requirement: Menu radiale del token

Il click destro su un token SHALL aprire, attorno al token, un menu radiale, purché siano vere entrambe le condizioni:

- chi clicca può modificarne le condizioni;
- nessuna pianificazione di movimento, misura o sagoma è in corso. Durante una pianificazione di movimento il click destro SHALL annullarla come `Esc`, senza aprire il menu; il menu si apre con un successivo click destro a mappa libera.

Il menu di una creatura SHALL contenere:

- Prono, Afferrato, Trattenuto e Avvelenato come interruttori. Disattivare Prono SHALL toglierlo senza costo di movimento, per i casi in cui la creatura non si alza da sola, come l'aiuto di un alleato o una decisione del Master;
- un comando `+`, che SHALL aprire un pannello a griglia con icona ed etichetta per le altre condizioni del catalogo e per il livello di Indebolimento;
- «Alzati», solo quando il token è Prono, che SHALL eseguire il comando di alzarsi con il suo costo e le sue regole di rifiuto;
- «Scatto» sul proprio token personaggio, anche quando non è utilizzabile; fuori dal proprio turno, prima dell'avvio del round o dopo averlo già usato SHALL restare visibile ma disabilitato, con il motivo accessibile da mouse e tastiera;
- «Aure», solo sul token canonico di un personaggio che ha almeno un'aura nella scheda, che SHALL aprire un pannello con un interruttore per ogni aura del personaggio, con il suo nome, il suo colore e il suo stato acceso o spento. Il pannello SHALL seguire le stesse regole di posizionamento del pannello `+`.

«Alzati», «Scatto» e «Aure» SHALL essere presentati come azioni, distinti visivamente dagli interruttori delle condizioni.

Lo stato attivo di ogni condizione SHALL essere riconoscibile anche senza il colore, con un segno di spunta. Il nome della voce indicata con il puntatore o raggiunta con la navigazione da tastiera SHALL comparire come testo visibile nel menu, con il suo stato e il suo tasto d'accesso, senza dipendere da un tooltip. All'apertura, prima di qualunque indicazione dell'utente, il menu SHALL NOT mostrare il nome di una voce.

Il menu di un veicolo SHALL contenere Rotto e Ribaltato. Il menu SHALL NOT offrire un accesso alla modale di modifica del token. Il menu SHALL chiudersi con `Esc` o con un click fuori, e SHALL restare aperto dopo l'attivazione di una condizione, così da permetterne altre.

Il menu, il pannello `+` e il pannello «Aure» SHALL restare interamente dentro l'area visibile della mappa, anche per un token vicino al bordo. I pannelli SHALL NOT coprire il token a cui si riferiscono.

#### Scenario: Apertura dal click destro

- **WHEN** un Adventurer, senza interazioni in corso, fa click destro sul proprio token
- **THEN** si apre il menu radiale con le quattro condizioni frequenti e il comando `+`, senza alcuna voce di modifica del token

#### Scenario: Click destro durante la pianificazione

- **WHEN** un Adventurer sta pianificando il movimento del proprio token e fa click destro sul token
- **THEN** la pianificazione si chiude senza inviare richieste e non si apre né il menu radiale né quello del browser; un secondo click destro sul token apre il menu radiale

#### Scenario: Token senza diritto di modifica

- **WHEN** un Adventurer fa click destro sul token di un altro personaggio
- **THEN** nessun menu si apre

#### Scenario: Pannello delle altre condizioni

- **WHEN** chi ha il menu aperto attiva `+`
- **THEN** compare il pannello con le altre dieci condizioni e il selettore del livello di Indebolimento

#### Scenario: Alzarsi con il proprio movimento

- **WHEN** a round avviato un Adventurer apre il menu del proprio token Prono e attiva «Alzati»
- **THEN** viene eseguito il comando di alzarsi con il suo costo di movimento

#### Scenario: Rialzato da un alleato

- **WHEN** a round avviato un Adventurer prono, aiutato da un alleato, disattiva Prono dal menu del proprio token
- **THEN** Prono viene tolto e nessun movimento viene addebitato

#### Scenario: Token al bordo della mappa

- **WHEN** il Master apre il menu di un token nell'angolo in basso a destra dell'area visibile e poi attiva `+`
- **THEN** il menu e il pannello restano interamente visibili e il pannello non copre il token

#### Scenario: Pannello delle aure

- **WHEN** un Adventurer con due aure nella scheda apre il menu del proprio token e attiva «Aure»
- **THEN** compare un pannello con i due interruttori, ciascuno con nome, colore e stato, e attivarne uno accende o spegne quell'aura lasciando il pannello aperto

#### Scenario: Personaggio senza aure

- **WHEN** un Adventurer senza aure nella scheda apre il menu del proprio token, oppure apre il menu del proprio famiglio
- **THEN** il menu non mostra la voce «Aure»

#### Scenario: Scatto accanto alle aure

- **WHEN** un Adventurer apre il menu del proprio personaggio che ha un'aura nella scheda
- **THEN** il menu mostra sia «Scatto» sia «Aure»; «Scatto» è attivabile nel proprio turno a round avviato, altrimenti resta visibile con il motivo della disabilitazione

### Requirement: Menu accessibile da tastiera

Il menu radiale SHALL aprirsi anche con `S` o con `Shift+F10` sul token che ha il fuoco da tastiera, alle stesse condizioni del click destro. Le scorciatoie SHALL restare inerti mentre il fuoco è in un campo di testo e mentre un'interazione di mappa è in corso. Nel menu:

- le voci, compreso il selettore del livello di Indebolimento, SHALL essere raggiungibili con i tasti freccia e attivabili con `Invio` o `Spazio`;
- ogni condizione SHALL avere un tasto d'accesso di una lettera, unico nel catalogo del tipo di token e mostrato nell'etichetta, che la attiva direttamente come la sua voce, anche dalla corona quando la condizione sta nel pannello `+`; «Alzati» SHALL avere un proprio tasto d'accesso, distinto da quello di Prono; «Aure» SHALL avere un proprio tasto d'accesso, distinto da quelli delle condizioni e di «Alzati», che apre il pannello delle aure;
- nel pannello delle aure gli interruttori SHALL essere raggiungibili con i tasti freccia, attivabili con `Invio` o `Spazio` e annunciare nome e stato, ed `Esc` SHALL riportare alla corona;
- i tasti da `0` a `6` SHALL impostare direttamente il livello di Indebolimento di una creatura;
- ogni condizione SHALL annunciare il proprio nome e il proprio stato attivo o inattivo;
- i tasti gestiti dal menu SHALL NOT raggiungere le scorciatoie della mappa: frecce, lettere, `Canc` e `Backspace` premuti nel menu SHALL NOT muovere, cancellare il token o attivare uno strumento di mappa;
- la chiusura SHALL restituire il fuoco al token.

La legenda dei comandi SHALL elencare il click destro, `S`, `Shift+F10`, i tasti d'accesso delle condizioni, di «Alzati» e di «Aure» e i tasti `0`-`6`.

#### Scenario: Menu da tastiera

- **WHEN** un Adventurer porta il fuoco sul proprio token e preme `S`
- **THEN** il menu si apre con il fuoco sulla prima voce, e dopo `Esc` il fuoco torna al token

#### Scenario: Condizione con il tasto d'accesso

- **WHEN** un Adventurer porta il fuoco sul proprio token in piedi, preme `S` e poi `P`
- **THEN** il token diventa Prono e il menu resta aperto

#### Scenario: Frecce nel menu

- **WHEN** il Master ha selezionato un token, ne apre il menu e preme freccia destra e poi `Canc`
- **THEN** il fuoco passa alla voce successiva e il token non si muove né viene cancellato

#### Scenario: Tasto S mentre si scrive

- **WHEN** il fuoco è nella textarea dei comandi e l'utente scrive `s`
- **THEN** nessun menu si apre

#### Scenario: Aura da tastiera

- **WHEN** un Adventurer con un'aura spenta porta il fuoco sul proprio token, preme `S`, poi il tasto d'accesso di «Aure» e poi `Invio`
- **THEN** l'aura si accende, il suo nuovo stato viene annunciato e il token non si muove
