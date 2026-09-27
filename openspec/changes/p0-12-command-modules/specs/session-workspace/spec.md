## RENAMED Requirements

- FROM: `### Requirement: Controlli esistenti e legenda`
- TO: `### Requirement: Controlli esistenti e moduli di guida`

## MODIFIED Requirements

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
