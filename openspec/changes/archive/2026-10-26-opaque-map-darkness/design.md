## Context
Il riempimento `.board-darkness-layer__shade` usa `rgba(3, 3, 4, 0.96)`. La maschera SVG determina le aree rivelate.
## Goals / Non-Goals
Buio opaco; nessuna riscrittura della geometria di visione o della sanitizzazione server.
## Decisions
Usare nero #000 con alpha 1 nelle zone interamente oscurate. Verificare anche bordi, gradienti e compositing: nessun effetto deve rivelare dettagli nella zona esclusa dalla visione. Conservare l'attuale accesso del master e le aree legittimamente visibili, senza oscurare i suoi controlli.
## Risks
La correzione del solo fill potrebbe essere insufficiente in presenza di opacity su antenati. Serve verifica visiva con sfondo ad alto contrasto, zoom e fullscreen.
## Verification
Campionare un punto interno completamente buio: RGB (0,0,0), anche cambiando lo sfondo sottostante. Verificare separatamente luci, scurovisione, ostacoli e mappa illuminata.

## Coordinamento con memoria dell'esplorazione
La proposta [persistent-explored-map](../2026-10-26-persistent-explored-map/proposal.md) aggiunge memoria del terreno. Se applicata, la copertura nera piena interessa la regione non esplorata e fuori dalla visione corrente; il terreno ricordato resta visibile. La memoria non rende trasparente il nero: determina dove la copertura si applica. Verificare entrambi i change insieme prima dell'archiviazione.

## Bordo sfumato
Coordinare anche [soft-darkness-edges](../2026-10-26-soft-darkness-edges/proposal.md): nero #000 alpha 1 nelle zone sconosciute, sfumatura soltanto sul lato rivelato del confine. Il feather non deve essere implementato abbassando l'opacità dell'intero livello.
