## RENAMED Requirements

- FROM: `### Requirement: Quattro tab principali`
- TO: `### Requirement: Cinque tab principali`

## MODIFIED Requirements

### Requirement: Cinque tab principali

Il pannello destro SHALL esporre in alto le tab Chat + Dadi, Turni di iniziativa, Personaggi, Impostazioni e Legenda dei comandi. La tab Chat + Dadi SHALL contenere il log dei tiri, ordinato dal più remoto al più recente e scorrevole in modo indipendente. La tab Impostazioni SHALL raccogliere le preferenze personali di presentazione dei dadi, che restano locali al browser e SHALL NOT modificare l'esperienza degli altri partecipanti. I controlli di lancio e l'input dei comandi SHALL occupare la sezione inferiore del pannello e restare disponibili al cambio di tab; l'input SHALL essere una textarea a tutta larghezza, sotto i dadi, e inviare il comando `/r` con Invio. In P0.3 non SHALL essere richiesto l'invio di messaggi testuali tra partecipanti. Le tab SHALL essere navigabili da tastiera e indicare quella attiva. Le tab SHALL occupare una sola riga alla larghezza nominale del pannello, riducendo il proprio ingombro invece di andare a capo.

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

## ADDED Requirements

### Requirement: Attribuzione delle risorse grafiche con licenza che la richiede

Quando il prodotto include risorse grafiche la cui licenza impone attribuzione, il client SHALL esporre in una superficie stabile e raggiungibile del pannello destro il nome della risorsa, l'autore e la licenza applicata. L'attribuzione SHALL restare leggibile senza dipendere dallo stato di una sessione o dal ruolo del partecipante.

#### Scenario: Attribuzione del set di icone dei dadi

- **WHEN** un partecipante cerca le informazioni di licenza delle icone dei dadi
- **THEN** le trova in una tab del pannello destro, con autore e licenza dichiarati

#### Scenario: Attribuzione indipendente dal ruolo

- **WHEN** un Player senza permessi di gestione consulta la stessa superficie
- **THEN** vede la medesima attribuzione di un Master
