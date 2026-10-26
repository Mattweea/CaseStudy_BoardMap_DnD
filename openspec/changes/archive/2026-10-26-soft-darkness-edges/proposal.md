## Why

Il confine fra nero e zona scoperta non deve apparire come un ritaglio netto. Serve una transizione sfumata coerente con il buio opaco e con la memoria del terreno esplorato.

## What Changes

- Sfumare il bordo del nero lungo le aree rivelate dalla visuale e dalla memoria.
- Mantenere nero pieno nelle aree sconosciute: la sfumatura si sviluppa verso la parte già rivelata, non lascia intravedere oltre muri o limiti di visione.
- Usare la stessa resa in board normale e fullscreen, con zoom e pan coerenti.

## Capabilities

### New Capabilities

- `darkness-edge-presentation`: fascia di transizione morbida tra terreno rivelato e buio pieno.

### Modified Capabilities

Nessuna modifica dei canonici in Propose. Coordinamento con i change pendenti [opaque-map-darkness](../2026-10-26-opaque-map-darkness/proposal.md), [persistent-explored-map](../2026-10-26-persistent-explored-map/proposal.md) e [freehand-vision-walls](../2026-10-26-freehand-vision-walls/proposal.md).

## Impact

Rendering e compositing delle maschere della board; documentazione frontend di visione da aggiornare in Apply. Nessun nuovo permesso o dato condiviso dovuto alla sola sfumatura. Implementato e verificato sul branch dedicato derivato da test.
