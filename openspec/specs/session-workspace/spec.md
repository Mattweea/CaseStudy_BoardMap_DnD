# session-workspace Specification

## Purpose

Offrire a Master e Player una superficie di sessione in cui la mappa resta centrale e le funzioni di gioco sono organizzate in un pannello navigabile.

## Requirements

### Requirement: Composizione desktop della sessione

La sessione SHALL mostrare su desktop la mappa al centro-sinistra per circa tre quarti della larghezza e un pannello richiudibile a destra per circa un quarto. Chiudere il pannello SHALL dare più spazio utilizzabile alla mappa senza interrompere la sessione.

#### Scenario: Apertura e chiusura del pannello

- **WHEN** un partecipante apre la sessione su desktop e richiude o riapre il pannello
- **THEN** la mappa rimane visibile e utilizzabile e il pannello occupa circa un quarto della larghezza quando è aperto

### Requirement: Zoom e interazioni col mouse della mappa

La mappa SHALL mantenere pulsanti visibili Zoom in (+) e Zoom out (−), lo spostamento della visuale con Ctrl+trascinamento o tasto centrale e il trascinamento dei token secondo i permessi già assegnati al partecipante. Queste interazioni SHALL funzionare sia con il pannello destro aperto sia con il pannello richiuso; un Player non SHALL poter spostare token che non controlla.

La mappa SHALL esporre inoltre tre strumenti disponibili a ogni partecipante autenticato, indipendenti dai permessi sui token: righello, sagoma di area e ping. I loro controlli SHALL essere raggiungibili da tastiera come gli altri controlli di mappa e SHALL restare utilizzabili con il pannello destro aperto o richiuso. Attivare uno di questi strumenti SHALL NOT impedire zoom e spostamento della visuale, e `Esc` SHALL riportare la mappa all'interazione predefinita. Nessuno di questi strumenti SHALL spostare la visuale di un altro partecipante.

Ogni controllo di questi strumenti SHALL avere un nome accessibile testuale: un'icona SHALL NOT essere l'unica fonte del nome del controllo. Ciascuno SHALL inoltre essere attivabile con una scorciatoia di tastiera a tasto singolo, che SHALL NOT agire mentre il fuoco è in un campo di testo né mentre è in corso un'interazione sulla mappa.

La mappa SHALL mostrare una riga testuale che dichiara i gesti disponibili per l'interazione in corso e che annuncia a chi usa una tecnologia assistiva gli avvisi relativi al movimento: percorso bloccato, budget insufficiente, destinazione occupata e rifiuto del server.

#### Scenario: Zoom e spostamento della visuale

- **WHEN** un partecipante usa i pulsanti + e − o trascina la visuale con Ctrl o con il tasto centrale
- **THEN** ingrandimento e posizione della mappa cambiano senza perdere la possibilità di usare il pannello destro

#### Scenario: Trascinamento di un token autorizzato

- **WHEN** un Player trascina col mouse un proprio token e tenta di trascinare un token non controllato
- **THEN** il proprio token segue il flusso di movimento già disponibile e il token non controllato non viene spostato

#### Scenario: Strumenti di misura disponibili a ogni ruolo

- **WHEN** un Player attiva il righello o la sagoma di area con il pannello destro richiuso
- **THEN** lo strumento è utilizzabile sulla mappa, zoom e spostamento della visuale restano disponibili e `Esc` riporta la mappa all'interazione predefinita

#### Scenario: Scorciatoia inerte mentre si scrive

- **WHEN** un partecipante digita in un campo di testo una lettera che è anche la scorciatoia di uno strumento di mappa
- **THEN** la lettera è scritta nel campo e nessuno strumento di mappa viene attivato

#### Scenario: Avviso di movimento leggibile senza vedere la mappa

- **WHEN** un percorso pianificato attraversa un ostacolo o supera il budget residuo
- **THEN** la condizione è disponibile come testo annunciato, oltre che come segnale sulla mappa

### Requirement: Cinque tab principali

Il pannello destro SHALL esporre in alto le tab Chat + Dadi, Turni di iniziativa, Personaggi, Impostazioni e Moduli. La tab Chat + Dadi SHALL contenere il log dei tiri, ordinato dal più remoto al più recente e scorrevole in modo indipendente. La tab Impostazioni SHALL raccogliere le preferenze personali di presentazione dei dadi e dell'audio di combattimento, che restano locali al browser e SHALL NOT modificare l'esperienza degli altri partecipanti. Per il solo Master, la tab SHALL raccogliere anche le impostazioni condivise della sessione, fra cui la possibilità per i giocatori di terminare il proprio turno; un Adventurer SHALL vederne lo stato ma SHALL NOT poterle modificare. I controlli di lancio e l'input dei comandi SHALL occupare la sezione inferiore del pannello e restare disponibili al cambio di tab; l'input SHALL essere una textarea a tutta larghezza, sotto i dadi, e inviare il comando `/r` con Invio. In P0.3 non SHALL essere richiesto l'invio di messaggi testuali tra partecipanti. Le tab SHALL essere navigabili da tastiera e indicare quella attiva. Le tab SHALL occupare una sola riga alla larghezza nominale del pannello, riducendo il proprio ingombro invece di andare a capo.

#### Scenario: Cambio tab da tastiera

- **WHEN** un partecipante seleziona una delle cinque tab tramite tastiera
- **THEN** il pannello mostra il contenuto corrispondente e comunica quale tab è attiva, mentre i controlli dei dadi restano raggiungibili in basso

#### Scenario: Preferenze dei dadi raggiungibili dalla tab Impostazioni

- **WHEN** un partecipante apre la tab Impostazioni
- **THEN** trova i controlli per abilitare o disabilitare animazione 3D e audio dei dadi, e i controlli di lancio restano disponibili in basso

#### Scenario: Tab su una riga sola

- **WHEN** il pannello destro è aperto alla sua larghezza nominale con tutte e cinque le tab presenti
- **THEN** le tab stanno su una sola riga e nessuna va a capo

#### Scenario: Log e comando senza scroll della sidebar

- **WHEN** il log contiene più tiri della sua altezza disponibile
- **THEN** scorre soltanto il log, mantiene i tiri più remoti in alto e lascia accessibili dadi e textarea in basso

#### Scenario: Impostazioni di combattimento

- **WHEN** il Master apre la tab Impostazioni
- **THEN** trova il silenziamento e il volume dei suoni di combattimento, locali al suo browser, e l'impostazione condivisa che consente ai giocatori di terminare il proprio turno

#### Scenario: Impostazione di sessione vista da un Adventurer

- **WHEN** un Adventurer apre la tab Impostazioni
- **THEN** trova le proprie preferenze audio e vede se può terminare il proprio turno, senza un controllo per cambiarlo

#### Scenario: Nome della tab dei moduli

- **WHEN** un partecipante porta il fuoco sulla quinta tab
- **THEN** il suo nome accessibile è «Moduli» e nessuna tab si chiama più «Legenda dei comandi»

### Requirement: Roster e collegamento alla mappa

La tab Personaggi SHALL mostrare i profili del roster disponibili con nome e ritratto corrente e SHALL permettere di localizzare il token associato quando esiste. Un Adventurer autenticato SHALL poter aprire la propria scheda dalla tab e SHALL NOT poter aprire la scheda degli altri Adventurer; il Master SHALL poter aprire ogni scheda della campagna.

#### Scenario: Personaggio con token

- **WHEN** un partecipante seleziona un personaggio del roster con token presente sulla mappa
- **THEN** l'interfaccia rende disponibile l'azione per localizzare quel token

#### Scenario: Profilo senza token

- **WHEN** il roster comprende un profilo senza token nella scena
- **THEN** il profilo resta elencato e l'interfaccia non presenta un'azione di localizzazione inutilizzabile

#### Scenario: Adventurer apre la propria scheda

- **WHEN** un Adventurer seleziona il proprio profilo nella tab Personaggi
- **THEN** l'interfaccia rende disponibile l'apertura della propria scheda modificabile

#### Scenario: Adventurer vede il profilo altrui

- **WHEN** un Adventurer visualizza il profilo di un altro Adventurer
- **THEN** vede i soli dati pubblici del roster e non può aprirne la scheda

#### Scenario: Master apre una scheda

- **WHEN** il Master seleziona il profilo di un Adventurer
- **THEN** l'interfaccia rende disponibile l'apertura della scheda completa e modificabile

#### Scenario: Ritratto aggiornato

- **WHEN** il proprietario o il Master sostituisce il ritratto di una scheda
- **THEN** la tab Personaggi mostra il nuovo ritratto senza richiedere un ricaricamento della pagina

### Requirement: Controlli esistenti e moduli di guida

La riorganizzazione SHALL mantenere raggiungibili i controlli di mappa richiesti, inclusi zoom e selettore scena. I controlli di sessione, azioni e luce non richiesti SHALL essere nascosti dalla GUI senza rimuoverne il codice. I controlli Master eventualmente esposti SHALL restare riservati al Master.

La tab Moduli SHALL presentare la guida ai comandi come elenco di moduli per argomento. Ogni modulo SHALL comparire come controllo attivabile da mouse e da tastiera, con titolo e un riassunto di una riga. Il catalogo SHALL comprendere, nell'ordine:

- **Mappa e visuale**: zoom, spostamento della visuale, selezione, schermo intero, elenco degli elementi, manuale, localizzazione di un personaggio;
- **Movimento**: pianificazione del percorso con conferma e annullamento, spostamento da tastiera, e per il Player movimento extra e Scatto;
- **Strumenti di misura**: righello, sagome e ping, con le loro scorciatoie e l'uscita con `Esc`;
- **Combattimento e iniziativa**: avvio e gestione dei turni, tiro d'iniziativa e fine del turno secondo il ruolo;
- **Dadi**: vassoio, modificatore, visibilità, comandi `/r` e `/rs`, salto dell'animazione 3D e preferenze locali;
- **Condizioni**: apertura del menu radiale, tasti d'accesso, «Alzati», livelli di Indebolimento;
- **Aure**: accensione delle aure dal menu radiale e, per il Player, il pannello delle aure altrui in cui si trova;
- **Punti ferita**: modifica dei punti ferita dal menu radiale e dalla scheda;
- **Scheda personaggio**: apertura, spostamento della finestra, visibilità dei tiri dalla scheda;
- **Gestione della mappa**: creazione, rimozione, visibilità degli elementi, luci e annullamento globale, riservato al Master.

Attivare un modulo SHALL aprire una modale centrata sullo schermo con il titolo del modulo e il dettaglio completo dei suoi comandi. Il testo SHALL andare a capo e restare interamente leggibile, scorrendo all'interno della modale quando supera l'altezza disponibile, senza parti tagliate. La modale SHALL chiudersi con `Esc`, con il pulsante di chiusura e con un click sullo sfondo; all'apertura il fuoco SHALL entrare nella modale e alla chiusura SHALL tornare al modulo che l'ha aperta. Mentre la modale è aperta, i tasti premuti SHALL NOT attivare scorciatoie della mappa o della sessione, come spostamento, rimozione, strumenti di mappa o annullamento.

Ogni partecipante SHALL vedere nei moduli soltanto i comandi comuni e quelli del proprio ruolo. Un modulo che per il ruolo corrente non contiene comandi SHALL NOT comparire nell'elenco. Il filtro è di sola presentazione: SHALL NOT concedere né togliere permessi, che restano verificati dal server.

Ogni comando descritto SHALL corrispondere a un'interazione disponibile per quel ruolo nella versione consegnata, con il tasto o il gesto effettivo. Un comando non disponibile SHALL NOT comparire. La sintassi dei tiri da comando SHALL restare documentata nel modulo Dadi.

#### Scenario: Sessione del Master e del Player

- **WHEN** Master e Player aprono il nuovo pannello
- **THEN** ciascuno vede soltanto i controlli previsti dalla nuova superficie e il Player non acquisisce controlli Master

#### Scenario: Elenco dei moduli del Player

- **WHEN** un Adventurer apre la tab Moduli
- **THEN** vede i moduli da «Mappa e visuale» a «Scheda personaggio» e non vede «Gestione della mappa»

#### Scenario: Elenco dei moduli del Master

- **WHEN** il Master apre la tab Moduli
- **THEN** vede tutti i moduli del catalogo, compreso «Gestione della mappa»

#### Scenario: Apertura di un modulo da tastiera

- **WHEN** un partecipante porta il fuoco sul modulo «Strumenti di misura» e preme `Invio`
- **THEN** si apre una modale centrata intitolata «Strumenti di misura» che elenca righello `R`, ping `P`, sagome `C`, `O` e `L` e l'uscita con `Esc`, e il fuoco è nella modale

#### Scenario: Chiusura con ritorno del fuoco

- **WHEN** il partecipante chiude la modale con `Esc`
- **THEN** la modale si chiude, nessuno strumento di mappa è attivo e il fuoco torna al modulo «Strumenti di misura»

#### Scenario: Tasti inerti con la modale aperta

- **WHEN** un Adventurer con il proprio token sulla mappa apre il modulo «Movimento» e preme freccia destra, `R` e `Ctrl+Z`
- **THEN** il token non si muove, nessuno strumento si attiva, nessuna azione viene annullata e la modale resta aperta

#### Scenario: Contenuto per ruolo nello stesso modulo

- **WHEN** Master e Adventurer aprono ciascuno il modulo «Movimento»
- **THEN** l'Adventurer trova i tasti per muovere il proprio personaggio, il movimento extra e lo Scatto; il Master trova lo spostamento dei token selezionati e del gruppo, senza movimento extra né Scatto

#### Scenario: Testo lungo leggibile

- **WHEN** un partecipante apre il modulo «Condizioni» con la finestra alla larghezza minima supportata
- **THEN** tutti i tasti d'accesso sono leggibili per intero e la modale scorre al suo interno se il contenuto supera l'altezza disponibile

#### Scenario: Comando superato assente

- **WHEN** un partecipante consulta tutti i moduli visibili per il proprio ruolo
- **THEN** non trova comandi che la versione consegnata non offre, come un tasto `+` che apre la card Azioni

### Requirement: Layout su schermi stretti

Su schermi stretti il pannello SHALL funzionare come overlay richiudibile, lasciando la mappa utilizzabile quando è chiuso. Le cinque tab e i controlli di apertura e chiusura SHALL restare accessibili da tastiera.

#### Scenario: Vista mobile

- **WHEN** un partecipante usa una finestra stretta e chiude il pannello
- **THEN** può interagire con la mappa e riaprire il pannello per scegliere una tab

### Requirement: Attribuzione delle risorse grafiche con licenza che la richiede

Quando il prodotto include risorse grafiche la cui licenza impone attribuzione, il client SHALL esporre in una superficie stabile e raggiungibile del pannello destro il nome della risorsa, l'autore e la licenza applicata. L'attribuzione SHALL restare leggibile senza dipendere dallo stato di una sessione o dal ruolo del partecipante.

#### Scenario: Attribuzione del set di icone dei dadi

- **WHEN** un partecipante cerca le informazioni di licenza delle icone dei dadi
- **THEN** le trova in una tab del pannello destro, con autore e licenza dichiarati

#### Scenario: Attribuzione indipendente dal ruolo

- **WHEN** un Player senza permessi di gestione consulta la stessa superficie
- **THEN** vede la medesima attribuzione di un Master

### Requirement: Modale di modifica del token nascosta

La modale di modifica di un token SHALL NOT essere raggiungibile da alcuna superficie della GUI, per nessun ruolo:

- click destro o doppio click su un token o su un gruppo di token sulla mappa;
- click destro su una voce della tab Turni di iniziativa;
- comando di modifica nell'elenco degli elementi in mappa;
- voce del menu radiale del token.

Le modifiche ai dati di un personaggio SHALL passare dalla sua scheda; le condizioni SHALL passare dal menu radiale. Il codice della modale SHALL restare nel progetto, pronto per essere riesposto da una capability successiva. Nascondere la modale SHALL NOT cambiare le autorizzazioni del server: le vie di scrittura esistenti restano soggette agli stessi controlli.

#### Scenario: Doppio click sul proprio token

- **WHEN** un Adventurer fa doppio click sul proprio token
- **THEN** nessuna modale di modifica si apre

#### Scenario: Master sul token di un nemico

- **WHEN** il Master fa doppio click su un token nemico o click destro sulla sua voce nella tab Turni di iniziativa
- **THEN** nessuna modale di modifica si apre

#### Scenario: Elenco degli elementi

- **WHEN** il Master apre l'elenco degli elementi in mappa
- **THEN** le righe non offrono un comando di modifica
