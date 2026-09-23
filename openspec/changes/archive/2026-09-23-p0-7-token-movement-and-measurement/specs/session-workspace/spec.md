## MODIFIED Requirements

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
