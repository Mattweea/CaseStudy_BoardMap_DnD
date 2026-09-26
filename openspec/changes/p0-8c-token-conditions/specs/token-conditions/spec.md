## Purpose

Dare ai token le condizioni ufficiali del PHB 5e 2014, applicabili rapidamente dal token stesso da chi ne ha il diritto, con un catalogo validato dal server e modifiche che non si cancellano a vicenda.

## ADDED Requirements

### Requirement: Catalogo delle condizioni per tipo di token

Le creature (token Player e Nemico) SHALL poter avere solo le quattordici condizioni del PHB 5e 2014:

- Accecato, Affascinato, Assordato, Spaventato;
- Afferrato, Incapacitato, Invisibile, Paralizzato;
- Pietrificato, Avvelenato, Prono, Trattenuto;
- Stordito, Privo di sensi.

A queste si aggiunge Indebolimento, con un livello intero da 0 a 6, dove 0 significa assente. I veicoli SHALL poter avere solo Rotto e Ribaltato. Gli oggetti SHALL NOT avere condizioni. Ogni condizione SHALL comparire al più una volta per token. Il server SHALL scartare, in ogni via di scrittura, qualunque condizione fuori dal catalogo del tipo di token, compreso il commit a stato pieno del Master.

#### Scenario: Condizione sconosciuta dal commit del Master

- **WHEN** un commit a stato pieno del Master contiene su un token Nemico le condizioni Prono e `pippo`
- **THEN** lo stato accettato contiene solo Prono

#### Scenario: Condizione di veicolo su una creatura

- **WHEN** una richiesta prova ad aggiungere Ribaltato a un token Player
- **THEN** il server la rifiuta e le condizioni del token non cambiano

### Requirement: Compatibilità degli snapshot con condizioni superate

Uno snapshot salvato prima di questa capability SHALL caricarsi senza errori. Le condizioni Morto, Condizionato e Ispirato, e ogni altra condizione fuori catalogo, SHALL essere rimosse durante la normalizzazione. Prono sulle creature e Rotto e Ribaltato sui veicoli SHALL essere conservate. Un token senza livello di Indebolimento SHALL assumere il livello 0.

#### Scenario: Snapshot con Morto e Prono

- **WHEN** viene ripreso uno snapshot in cui un token Player ha Morto e Prono
- **THEN** il token si carica con la sola condizione Prono e Indebolimento 0

### Requirement: Operazioni singole autorizzate

Una modifica delle condizioni SHALL essere un'operazione singola: aggiungere una condizione, toglierne una o impostare il livello di Indebolimento. Il server SHALL applicare l'operazione alle condizioni correnti del token, senza sostituire l'intero elenco con quello visto dal client. Aggiungere una condizione già presente o togliere una condizione assente SHALL lasciare il token invariato senza errore.

Solo due soggetti SHALL poter modificare le condizioni:

- l'Adventurer, solo sui token di cui è proprietario, famiglio compreso;
- il Master, su qualunque token.

Una richiesta non autorizzata SHALL essere rifiutata con errore di autorizzazione. Una richiesta per un token inesistente, con una condizione fuori catalogo o con un livello di Indebolimento fuori da 0-6 SHALL essere rifiutata con un motivo comprensibile. L'aggiornamento dei token propri SHALL NOT accettare più un elenco completo di condizioni. Ogni operazione accettata che cambia il token SHALL incrementare la versione dello stato e raggiungere tutti i client che vedono quel token.

#### Scenario: Modifiche contemporanee

- **WHEN** il Master aggiunge Afferrato al token di un Adventurer e, prima di ricevere l'aggiornamento, l'Adventurer aggiunge Avvelenato allo stesso token
- **THEN** il token finisce con entrambe le condizioni

#### Scenario: Token altrui

- **WHEN** un Adventurer prova ad aggiungere Prono al token di un altro personaggio
- **THEN** il server rifiuta la richiesta con errore di autorizzazione e il token non cambia

#### Scenario: Famiglio

- **WHEN** un Adventurer aggiunge Spaventato al proprio famiglio
- **THEN** l'operazione è accettata

#### Scenario: Elenco completo nell'aggiornamento del token

- **WHEN** un Adventurer invia l'aggiornamento del proprio token con un elenco completo di condizioni
- **THEN** l'elenco viene ignorato e le condizioni del token non cambiano

### Requirement: Privo di sensi porta Prono

Aggiungere Privo di sensi a una creatura SHALL aggiungere anche Prono nella stessa operazione, se non è già presente, come prevede il PHB 2014. Togliere Privo di sensi SHALL NOT togliere Prono.

#### Scenario: Svenimento

- **WHEN** a un token in piedi viene aggiunto Privo di sensi
- **THEN** il token ha Privo di sensi e Prono dopo una sola operazione

#### Scenario: Risveglio

- **WHEN** a un token con Privo di sensi e Prono viene tolto Privo di sensi
- **THEN** il token resta Prono

### Requirement: Invisibile come marcatore

La condizione Invisibile SHALL essere un marcatore: il token SHALL restare visibile a ogni partecipante che già lo vedeva, reso semitrasparente e con il badge della condizione. La condizione SHALL NOT nascondere il token né rimuoverlo dallo stato inviato agli Adventurer. Il nascondimento di un token da parte del Master SHALL restare una funzione distinta, con le proprie regole.

#### Scenario: Mago invisibile

- **WHEN** un Adventurer aggiunge Invisibile al proprio token
- **THEN** gli altri Adventurer continuano a vedere il token, semitrasparente e con il badge Invisibile

### Requirement: Menu radiale del token

Il click destro su un token SHALL aprire, attorno al token, un menu radiale, purché siano vere entrambe le condizioni:

- chi clicca può modificarne le condizioni;
- nessuna pianificazione di movimento, misura o sagoma è in corso. Durante una pianificazione di movimento il click destro SHALL annullarla come `Esc`, senza aprire il menu; il menu si apre con un successivo click destro a mappa libera.

Il menu di una creatura SHALL contenere:

- Prono, Afferrato, Trattenuto e Avvelenato come interruttori. Disattivare Prono SHALL toglierlo senza costo di movimento, per i casi in cui la creatura non si alza da sola, come l'aiuto di un alleato o una decisione del Master;
- un comando `+`, che SHALL aprire un pannello a griglia con icona ed etichetta per le altre condizioni del catalogo e per il livello di Indebolimento;
- «Alzati», solo quando il token è Prono, che SHALL eseguire il comando di alzarsi con il suo costo e le sue regole di rifiuto;
- «Scatto», solo quando lo scatto è disponibile per quel token.

«Alzati» e «Scatto» SHALL essere presentati come azioni, distinti visivamente dagli interruttori delle condizioni.

Lo stato attivo di ogni condizione SHALL essere riconoscibile anche senza il colore, con un segno di spunta. Il nome della voce indicata con il puntatore o raggiunta con la navigazione da tastiera SHALL comparire come testo visibile nel menu, con il suo stato e il suo tasto d'accesso, senza dipendere da un tooltip. All'apertura, prima di qualunque indicazione dell'utente, il menu SHALL NOT mostrare il nome di una voce.

Il menu di un veicolo SHALL contenere Rotto e Ribaltato. Il menu SHALL NOT offrire un accesso alla modale di modifica del token. Il menu SHALL chiudersi con `Esc` o con un click fuori, e SHALL restare aperto dopo l'attivazione di una condizione, così da permetterne altre.

Il menu e il pannello `+` SHALL restare interamente dentro l'area visibile della mappa, anche per un token vicino al bordo. Il pannello `+` SHALL NOT coprire il token a cui si riferisce.

#### Scenario: Apertura dal click destro

- **WHEN** un Adventurer, senza interazioni in corso, fa click destro sul proprio token
- **THEN** si apre il menu radiale con le quattro condizioni frequenti e il comando `+`, senza alcuna voce di modifica del token

#### Scenario: Click destro durante la pianificazione

- **WHEN** un Adventurer sta pianificando il movimento del proprio token e fa click destro sul token
- **THEN** la pianificazione si chiude senza inviare richieste e il menu non si apre; un secondo click destro sul token apre il menu

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

### Requirement: Menu accessibile da tastiera

Il menu radiale SHALL aprirsi anche con `S` o con `Shift+F10` sul token che ha il fuoco da tastiera, alle stesse condizioni del click destro. Le scorciatoie SHALL restare inerti mentre il fuoco è in un campo di testo e mentre un'interazione di mappa è in corso. Nel menu:

- le voci, compreso il selettore del livello di Indebolimento, SHALL essere raggiungibili con i tasti freccia e attivabili con `Invio` o `Spazio`;
- ogni condizione SHALL avere un tasto d'accesso di una lettera, unico nel catalogo del tipo di token e mostrato nell'etichetta, che la attiva direttamente come la sua voce, anche dalla corona quando la condizione sta nel pannello `+`; «Alzati» SHALL avere un proprio tasto d'accesso, distinto da quello di Prono;
- i tasti da `0` a `6` SHALL impostare direttamente il livello di Indebolimento di una creatura;
- ogni condizione SHALL annunciare il proprio nome e il proprio stato attivo o inattivo;
- i tasti gestiti dal menu SHALL NOT raggiungere le scorciatoie della mappa: frecce, lettere, `Canc` e `Backspace` premuti nel menu SHALL NOT muovere, cancellare il token o attivare uno strumento di mappa;
- la chiusura SHALL restituire il fuoco al token.

La legenda dei comandi SHALL elencare il click destro, `S`, `Shift+F10`, i tasti d'accesso delle condizioni e di «Alzati» e i tasti `0`-`6`.

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

### Requirement: Badge delle condizioni sul token

Il token SHALL mostrare le condizioni attive come badge con icona, fino a tre, seguiti da un indicatore «+N» per le restanti. Indebolimento SHALL mostrare il proprio livello. Ogni badge SHALL avere un nome testuale accessibile, e l'elenco completo SHALL essere consultabile senza mouse. Le icone SHALL rispettare il requisito di attribuzione delle risorse grafiche con licenza.

#### Scenario: Cinque condizioni

- **WHEN** un token ha Prono, Avvelenato, Afferrato, Spaventato e Indebolimento 2
- **THEN** il token mostra tre badge e «+2», e l'elenco completo, con il livello 2 di Indebolimento, è disponibile come testo

### Requirement: Annullamento delle modifiche alle condizioni

Un Adventurer SHALL poter annullare la propria ultima operazione sulle condizioni con il comando di annullamento esistente. L'annullamento SHALL invertire soltanto ciò che quell'operazione ha cambiato, senza toccare condizioni aggiunte o tolte da altri nel frattempo. Nessun Adventurer SHALL poter annullare un'operazione altrui. Le operazioni del Master SHALL seguire l'annullamento a snapshot già previsto per il Master.

#### Scenario: Annullamento dello svenimento

- **WHEN** un Adventurer aggiunge Privo di sensi al proprio token in piedi, il Master aggiunge poi Avvelenato e l'Adventurer annulla
- **THEN** il token perde Privo di sensi e Prono e conserva Avvelenato
