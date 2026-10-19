## MODIFIED Requirements

### Requirement: Zoom e interazioni col mouse della mappa

La mappa SHALL mantenere pulsanti visibili Zoom in (+) e Zoom out (−), lo spostamento della visuale con Ctrl+trascinamento o tasto centrale e il trascinamento dei token secondo i permessi già assegnati al partecipante. Queste interazioni SHALL funzionare sia con il pannello destro aperto sia con il pannello richiuso; un Player non SHALL poter spostare token che non controlla.

La mappa SHALL essere navigabile con un trackpad senza ricorrere a tasti modificatori: un gesto di scorrimento a due dita SHALL spostare la visuale su entrambi gli assi, e un gesto di pinch a due dita SHALL variare l'ingrandimento. I due gesti SHALL essere distinti fra loro, così che scorrere non ingrandisca e avvicinare le dita non sposti la visuale.

La rotella del mouse, senza `Ctrl`, SHALL continuare a controllare l'ingrandimento. Tenendo premuto `Ctrl`, la rotella SHALL spostare la visuale in verticale invece di ingrandire; tenendo premuto `Alt`, SHALL spostarla in orizzontale. Il client SHALL riconoscere come rotella un evento che avanza per righe o per scatti ampi, e come trackpad un evento a delta piccoli in pixel: uno scorrimento a due dita solo verticale SHALL spostare la visuale anche quando i suoi delta sono interi e privi di componente orizzontale. Una volta riconosciuta, la sorgente SHALL restare la stessa per l'intero gesto.

Ogni variazione di ingrandimento ottenuta con un gesto continuo SHALL essere proporzionale all'ampiezza del gesto e SHALL progredire in modo percettivamente uniforme a ogni livello di scala, così che un singolo gesto non porti l'ingrandimento a fondo scala. I pulsanti + e − SHALL condividere la medesima progressione, così che pulsanti e gesti raggiungano gli stessi livelli. L'ingrandimento SHALL restare entro limiti configurati che permettano sia una visione d'insieme del tavolo sia la lettura di un token di una singola cella.

L'ingrandimento comandato dal puntatore SHALL essere ancorato al puntatore: la cella sotto il cursore o sotto le dita SHALL restare sotto il cursore o sotto le dita per l'intera durata del gesto. L'ingrandimento comandato dai pulsanti + e − non ha un puntatore di riferimento e SHALL conservare il centro della visuale.

Lo spostamento della visuale SHALL seguire il gesto in modo continuo, senza vincolare la visuale ai confini delle celle; le posizioni dei token e il piazzamento sulla mappa SHALL restare agganciati alle celle intere. A qualunque ingrandimento e a qualunque posizione della visuale, la cella individuata da un click, dalla pianificazione di un movimento, da una sagoma, da un ping o da una selezione ad area SHALL essere la cella effettivamente sotto il puntatore.

Il gesto di conferma di un movimento pianificato SHALL restare riservato a quella conferma: la barra spaziatrice non SHALL spostare la visuale in nessuna condizione. Lo spostamento della visuale non SHALL essere associato al tasto destro, che resta riservato al menu delle condizioni e all'annullamento di un piano.

L'ingrandimento e la posizione della visuale SHALL restare locali al partecipante: nessun gesto di navigazione SHALL modificare la visuale di un altro partecipante né entrare nello stato condiviso della sessione.

La mappa SHALL esporre inoltre tre strumenti disponibili a ogni partecipante autenticato, indipendenti dai permessi sui token: righello, sagoma di area e ping. I loro controlli SHALL essere raggiungibili da tastiera come gli altri controlli di mappa e SHALL restare utilizzabili con il pannello destro aperto o richiuso. Attivare uno di questi strumenti SHALL NOT impedire zoom e spostamento della visuale, e `Esc` SHALL riportare la mappa all'interazione predefinita. Nessuno di questi strumenti SHALL spostare la visuale di un altro partecipante.

Ogni controllo di questi strumenti SHALL avere un nome accessibile testuale: un'icona SHALL NOT essere l'unica fonte del nome del controllo. Ciascuno SHALL inoltre essere attivabile con una scorciatoia di tastiera a tasto singolo, che SHALL NOT agire mentre il fuoco è in un campo di testo né mentre è in corso un'interazione sulla mappa.

La mappa SHALL mostrare una riga testuale che dichiara i gesti disponibili per l'interazione in corso e che annuncia a chi usa una tecnologia assistiva gli avvisi relativi al movimento: percorso bloccato, budget insufficiente, destinazione occupata e rifiuto del server.

La guida dei comandi consultabile dentro l'applicazione SHALL dichiarare i gesti di navigazione della mappa effettivamente disponibili, inclusi quelli del trackpad.

#### Scenario: Zoom e spostamento della visuale

- **WHEN** un partecipante usa i pulsanti + e − o trascina la visuale con Ctrl o con il tasto centrale
- **THEN** ingrandimento e posizione della mappa cambiano senza perdere la possibilità di usare il pannello destro

#### Scenario: Scorrimento a due dita sposta la visuale

- **WHEN** un partecipante scorre con due dita sul trackpad sopra la mappa, in verticale e in orizzontale
- **THEN** la visuale si sposta su entrambi gli assi seguendo il gesto, l'ingrandimento non cambia e la pagina attorno alla mappa non scorre

#### Scenario: Scorrimento a due dita solo verticale non ingrandisce

- **WHEN** un partecipante scorre con due dita sul trackpad solo in verticale, con un touchpad che emette delta interi e nessuna componente orizzontale
- **THEN** la visuale si sposta in verticale e l'ingrandimento non cambia per l'intero gesto

#### Scenario: Pinch a due dita ingrandisce attorno alle dita

- **WHEN** un partecipante allontana e poi riavvicina due dita sul trackpad partendo da una cella riconoscibile della mappa
- **THEN** l'ingrandimento cresce e decresce in proporzione al gesto, quella cella resta sotto le dita per tutto il gesto e un singolo gesto non porta l'ingrandimento al suo limite

#### Scenario: Rotella del mouse invariata

- **WHEN** un partecipante che usa un mouse ruota la rotella sopra la mappa, senza tenere premuto `Ctrl`
- **THEN** la mappa si ingrandisce o si rimpicciolisce come prima del cambio, ancorandosi alla cella sotto il cursore, e la visuale non si sposta lateralmente

#### Scenario: Ctrl+rotella sposta la visuale in verticale

- **WHEN** un partecipante tiene premuto `Ctrl` e ruota la rotella del mouse sopra la mappa
- **THEN** la visuale si sposta in verticale seguendo il verso della rotella, l'ingrandimento non cambia e la visuale non si sposta lateralmente

#### Scenario: Alt+rotella sposta la visuale in orizzontale

- **WHEN** un partecipante tiene premuto `Alt` e ruota la rotella del mouse sopra la mappa
- **THEN** la visuale si sposta in orizzontale, verso destra ruotando verso il basso e verso sinistra ruotando verso l'alto, e l'ingrandimento non cambia

#### Scenario: Cella individuata correttamente dopo uno spostamento parziale

- **WHEN** un partecipante sposta la visuale con un gesto che si arresta a metà di una cella e poi pianifica un movimento, traccia una sagoma o lascia un ping
- **THEN** la cella scelta è quella effettivamente sotto il puntatore e i token restano su celle intere

#### Scenario: Barra spaziatrice riservata alla conferma del movimento

- **WHEN** un partecipante con un piano di movimento aperto preme la barra spaziatrice, e la preme di nuovo senza alcun piano aperto
- **THEN** la prima pressione conferma il movimento pianificato e la seconda non sposta la visuale

#### Scenario: Visuale di un altro partecipante mai spostata

- **WHEN** un partecipante ingrandisce e sposta la propria visuale
- **THEN** la visuale degli altri partecipanti resta dove si trovava e lo stato condiviso della sessione non cambia

#### Scenario: Ingrandimento salvato da una sessione precedente

- **WHEN** un partecipante riapre la sessione dopo avere salvato in precedenza un ingrandimento con i limiti allora in vigore
- **THEN** la mappa si apre a un ingrandimento valido entro i limiti correnti, senza errori e senza reimpostare le altre preferenze locali

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
