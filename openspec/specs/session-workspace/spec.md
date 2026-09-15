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

#### Scenario: Zoom e spostamento della visuale

- **WHEN** un partecipante usa i pulsanti + e − o trascina la visuale con Ctrl o con il tasto centrale
- **THEN** ingrandimento e posizione della mappa cambiano senza perdere la possibilità di usare il pannello destro

#### Scenario: Trascinamento di un token autorizzato

- **WHEN** un Player trascina col mouse un proprio token e tenta di trascinare un token non controllato
- **THEN** il proprio token segue il flusso di movimento già disponibile e il token non controllato non viene spostato

### Requirement: Quattro tab principali

Il pannello destro SHALL esporre in alto le tab Chat + Dadi, Turni di iniziativa, Personaggi e Legenda dei comandi. La tab Chat + Dadi SHALL contenere il log dei tiri. I controlli di lancio e l'input dei comandi SHALL occupare la sezione inferiore del pannello e restare disponibili al cambio di tab; lo spazio sopra tale sezione nella tab Chat + Dadi SHALL poter ospitare la futura chat testuale. In P0.3 non SHALL essere richiesto l'invio di messaggi testuali tra partecipanti. Le tab SHALL essere navigabili da tastiera e indicare quella attiva.

#### Scenario: Cambio tab da tastiera

- **WHEN** un partecipante seleziona una delle quattro tab tramite tastiera
- **THEN** il pannello mostra il contenuto corrispondente e comunica quale tab è attiva, mentre i controlli dei dadi restano raggiungibili in basso

### Requirement: Roster e collegamento alla mappa

La tab Personaggi SHALL mostrare i profili del roster disponibili con nome e immagine e SHALL permettere di localizzare il token associato quando esiste. Non SHALL richiedere una scheda personale prima di P0.4.

#### Scenario: Personaggio con token

- **WHEN** un partecipante seleziona un personaggio del roster con token presente sulla mappa
- **THEN** l'interfaccia localizza quel token senza aprire una scheda inesistente

#### Scenario: Profilo senza token

- **WHEN** il roster comprende un profilo senza token nella scena
- **THEN** il profilo resta elencato e l'interfaccia non presenta un'azione di localizzazione inutilizzabile

### Requirement: Controlli esistenti e legenda

La riorganizzazione SHALL mantenere raggiungibili i controlli di sessione, mappa, azioni e luce già disponibili per ciascun ruolo. La tab Legenda dei comandi SHALL riutilizzare la legenda esistente e includere la sintassi dei tiri da comando. I controlli Master SHALL restare riservati al Master.

#### Scenario: Sessione del Master e del Player

- **WHEN** Master e Player aprono il nuovo pannello
- **THEN** ciascuno raggiunge i controlli già consentiti al proprio ruolo e il Player non acquisisce controlli Master

### Requirement: Layout su schermi stretti

Su schermi stretti il pannello SHALL funzionare come overlay richiudibile, lasciando la mappa utilizzabile quando è chiuso. Le quattro tab e i controlli di apertura e chiusura SHALL restare accessibili da tastiera.

#### Scenario: Vista mobile

- **WHEN** un partecipante usa una finestra stretta e chiude il pannello
- **THEN** può interagire con la mappa e riaprire il pannello per scegliere una tab
