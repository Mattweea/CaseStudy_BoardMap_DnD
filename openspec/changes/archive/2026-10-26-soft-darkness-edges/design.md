## Context

Il nero pieno è richiesto nelle zone sconosciute, mentre il terreno già esplorato resta visibile. La nuova richiesta riguarda soltanto la transizione fra questi stati.

## Goals / Non-Goals

Bordo morbido senza rendere semitrasparente tutto il buio. Nessuna variazione del raggio visivo, dei blockers o della memoria acquisita.

## Decisions

- Separare regione geometricamente rivelata e maschera di presentazione. Aree sconosciute mantengono copertura #000 alpha 1. La fascia passa da nero a trasparente sul lato già rivelato, fino al terreno pienamente visibile.
- Parametro iniziale proposto: fascia di circa un quarto di cella, definita in coordinate mondo e scalata con lo zoom. Non aggiungere una nuova impostazione utente richiesta soltanto per l'implementazione; verificare la larghezza effettiva sulla mappa.
- Applicare il feather al confine esterno dell'unione visuale corrente + terreno ricordato, senza creare cuciture fra due regioni rivelate sovrapposte. La fascia non accumula esplorazione aggiuntiva e non sfuma i token.
- Se si usa blur SVG, ritagliare il risultato con la regione consentita: un blur simmetrico non vincolato potrebbe far filtrare immagine oltre un muro. Verificare angoli stretti, giunzioni, fori e clipping del filtro.
- Stesso renderer e convenzione nelle due Board; niente animazioni necessarie e nessuna dipendenza da pointer hover o input del Master.

## Risks

Il semplice blur dell'intero livello viola il nero pieno e può mostrare una stanza chiusa. Differenze di unità filtro/camera possono far variare il bordo durante pan o fullscreen. Il centro di un corridoio stretto deve restare leggibile senza buchi neri creati dall'intersezione delle fasce.

## Verification

Campionamento pixel: interno sconosciuto nero esatto e regione nota con transizione graduale senza salto. Screenshot di pareti, angoli, corridoi, fonti luminose sovrapposte e memoria; zoom minimo/massimo e fullscreen. Build e validazione OpenSpec; test geometrici se cambiano utility condivise. Aggiornare Docs/ai frontend durante Apply, senza descrivere ora la feature come implementata.
