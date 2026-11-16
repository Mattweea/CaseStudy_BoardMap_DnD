## Why

Il banner delle aure occupa una parte importante della mappa quando si applicano più effetti. La correzione richiesta direttamente sul branch `test` sostituisce l'elenco sempre aperto al centro con un indicatore compatto espandibile in alto a destra.

## What Changes

- Un pulsante Aure con contatore rimane visibile mentre si applicano aure altrui; l'elenco è inizialmente chiuso.
- L'apertura mostra un pannello limitato allo spazio della mappa, con le righe e i dettagli già disponibili. Un secondo click o Escape lo richiude.
- Normale e fullscreen usano lo stesso host attivo. Aggiornamenti, annunci accessibili e filtri di presenza conservano le regole attuali.

## Capabilities

### Modified Capabilities

- `token-auras`: presentazione compatta e richiudibile dell'avviso di presenza in alto a destra.

## Impact

Solo presentazione client: `AuraPresenceBanner`, CSS, catalogo dei comandi e contratto frontend. Nessuna modifica a geometria, API, permessi, database o migrazioni.
