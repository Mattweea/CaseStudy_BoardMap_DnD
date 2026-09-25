## MODIFIED Requirements

### Requirement: Cinque tab principali

Il pannello destro SHALL esporre in alto le tab Chat + Dadi, Turni di iniziativa, Personaggi, Impostazioni e Legenda dei comandi. La tab Chat + Dadi SHALL contenere il log dei tiri, ordinato dal più remoto al più recente e scorrevole in modo indipendente. La tab Impostazioni SHALL raccogliere le preferenze personali di presentazione dei dadi e dell'audio di combattimento, che restano locali al browser e SHALL NOT modificare l'esperienza degli altri partecipanti. Per il solo Master, la tab SHALL raccogliere anche le impostazioni condivise della sessione, fra cui la possibilità per i giocatori di terminare il proprio turno; un Adventurer SHALL vederne lo stato ma SHALL NOT poterle modificare. I controlli di lancio e l'input dei comandi SHALL occupare la sezione inferiore del pannello e restare disponibili al cambio di tab; l'input SHALL essere una textarea a tutta larghezza, sotto i dadi, e inviare il comando `/r` con Invio. In P0.3 non SHALL essere richiesto l'invio di messaggi testuali tra partecipanti. Le tab SHALL essere navigabili da tastiera e indicare quella attiva. Le tab SHALL occupare una sola riga alla larghezza nominale del pannello, riducendo il proprio ingombro invece di andare a capo.

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
