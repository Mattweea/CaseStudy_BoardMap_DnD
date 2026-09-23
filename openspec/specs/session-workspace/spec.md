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

### Requirement: Quattro tab principali

Il pannello destro SHALL esporre in alto le tab Chat + Dadi, Turni di iniziativa, Personaggi e Legenda dei comandi. La tab Chat + Dadi SHALL contenere il log dei tiri, ordinato dal più remoto al più recente e scorrevole in modo indipendente. I controlli di lancio e l'input dei comandi SHALL occupare la sezione inferiore del pannello e restare disponibili al cambio di tab; l'input SHALL essere una textarea a tutta larghezza, sotto i dadi, e inviare il comando `/r` con Invio. In P0.3 non SHALL essere richiesto l'invio di messaggi testuali tra partecipanti. Le tab SHALL essere navigabili da tastiera e indicare quella attiva.

#### Scenario: Cambio tab da tastiera

- **WHEN** un partecipante seleziona una delle quattro tab tramite tastiera
- **THEN** il pannello mostra il contenuto corrispondente e comunica quale tab è attiva, mentre i controlli dei dadi restano raggiungibili in basso

#### Scenario: Log e comando senza scroll della sidebar

- **WHEN** il log contiene più tiri della sua altezza disponibile
- **THEN** scorre soltanto il log, mantiene i tiri più remoti in alto e lascia accessibili dadi e textarea in basso

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


### Requirement: Controlli esistenti e legenda

La riorganizzazione SHALL mantenere raggiungibili i controlli di mappa richiesti, inclusi zoom e selettore scena. I controlli di sessione, azioni e luce non richiesti SHALL essere nascosti dalla GUI senza rimuoverne il codice. La tab Legenda dei comandi SHALL riutilizzare la legenda esistente e includere la sintassi dei tiri da comando. I controlli Master eventualmente esposti SHALL restare riservati al Master.

#### Scenario: Sessione del Master e del Player

- **WHEN** Master e Player aprono il nuovo pannello
- **THEN** ciascuno vede soltanto i controlli previsti dalla nuova superficie e il Player non acquisisce controlli Master

### Requirement: Layout su schermi stretti

Su schermi stretti il pannello SHALL funzionare come overlay richiudibile, lasciando la mappa utilizzabile quando è chiuso. Le quattro tab e i controlli di apertura e chiusura SHALL restare accessibili da tastiera.

#### Scenario: Vista mobile

- **WHEN** un partecipante usa una finestra stretta e chiude il pannello
- **THEN** può interagire con la mappa e riaprire il pannello per scegliere una tab
