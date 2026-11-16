## Context

La richiesta autorizza la correzione sul branch `test`. Il comportamento richiesto è esplicito: ridurre l'ingombro, rendere espandibile il banner e collocarlo in alto a destra. L'attuale requisito «Avviso di presenza in un'aura» impone invece una lista sempre visibile al centro; il delta sostituisce intenzionalmente soltanto quella presentazione.

## Decisions

- Riutilizzare il portal nell'host attivo e il calcolo `auraPresenceFor`. Il pannello chiuso occupa solo il pulsante; aperto ha larghezza e altezza massime relative alla mappa, con scroll interno.
- Conservare in stato locale l'apertura generale e le righe espanse. Il pulsante dichiara `aria-expanded` e `aria-controls`; gli annunci di nuove aure funzionano anche a pannello chiuso e non lo aprono automaticamente.
- Escape da un controllo del pannello chiude il contenitore e riporta il focus al pulsante senza raggiungere le scorciatoie della board. Il normale click sul pulsante consente di richiuderlo anche su touch.
- Quando sparisce l'ultima aura o cambiano utente/scena, la successiva comparsa riparte chiusa. Gli aggiornamenti delle aure non riaprono il contenitore. Normale e fullscreen usano la stessa presentazione nel rispettivo host.
- Aggiornare i comandi in-app e il contratto frontend insieme ai controlli.

## Verification

Test di componente per collasso, aggiornamenti, dettagli, uscita e filtri. Verifica browser con CSS reale su desktop/mobile e host fullscreen: dimensioni, ancoraggio, scroll e tastiera. Build, test aure, documentazione e validazione OpenSpec prima del commit.
