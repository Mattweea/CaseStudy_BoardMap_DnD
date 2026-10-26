## ADDED Requirements

### Requirement: Bordo sfumato del nero

Il sistema SHALL mostrare una transizione graduale dal nero al terreno rivelato lungo il confine fra buio e regione scoperta. La fascia SHALL svilupparsi verso la regione già rivelata; l'interno delle aree sconosciute SHALL restare nero pieno e opaco. Le zone rivelate sovrapposte SHALL NOT mostrare cuciture scure interne.

#### Scenario: Avanzamento in un corridoio

- **WHEN** un PG scopre progressivamente un corridoio buio
- **THEN** il bordo del nero sfuma verso il terreno scoperto senza un taglio visivo netto e senza mostrare il tratto ancora sconosciuto

#### Scenario: Memoria di una stanza

- **WHEN** il PG si allontana da una stanza esplorata
- **THEN** il terreno ricordato resta visibile e il confine con le zone ancora sconosciute mantiene la transizione morbida

#### Scenario: Aree rivelate sovrapposte

- **WHEN** due regioni di visione o memoria si sovrappongono
- **THEN** la transizione interessa soltanto il confine esterno e non disegna un bordo scuro nella sovrapposizione

### Requirement: Sfumatura senza rivelazione aggiuntiva

La sfumatura SHALL NOT ampliare la regione visibile o esplorata, aggirare muri e ostacoli, modificare la visibilità delle creature o rendere trasparente l'interno del buio.

#### Scenario: Stanza oltre un muro

- **WHEN** un PG osserva un muro che nasconde una stanza non esplorata
- **THEN** la sfumatura resta sul lato rivelato e nessun dettaglio della stanza filtra attraverso il bordo

### Requirement: Coerenza della transizione

Board normale e fullscreen SHALL mostrare la stessa transizione in coordinate della mappa. Pan, zoom e resize SHALL mantenerla allineata al confine senza rivelazioni transitorie o ritagli del filtro.

#### Scenario: Zoom e fullscreen

- **WHEN** il Player cambia zoom, sposta la camera e apre la board fullscreen
- **THEN** il bordo resta morbido, allineato alle stesse regioni e coerente con la scala della mappa
