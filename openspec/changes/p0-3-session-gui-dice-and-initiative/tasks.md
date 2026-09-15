## 1. Contratto e sicurezza dei tiri

- [x] 1.1 Definire tipi di richiesta/risposta e parser server per `NdS` con modificatore opzionale, dadi supportati e limiti espliciti; verificare con casi validi (`1d20-3`, più dadi, modificatore negativo) e invalidi che il parser non produca tiri fuori contratto.
- [x] 1.2 Implementare sul server l'endpoint autenticato di tiro con generazione dei dadi, calcolo e autore/timestamp derivati dal server; verificare che payload con totale o autore falsificati non alterino il log e che un errore non crei alcuna voce.
- [ ] 1.3 Rendere il log proprietà del server, attribuire autore e visibilità a ogni tiro e impedire che PUT dello stato, undo, restore o l'endpoint legacy inseriscano o cancellino tiri arbitrari; verificare con richieste mirate che un Player non possa alterare i tiri altrui.
- [ ] 1.4 Filtrare log e anteprime per destinatario in ogni snapshot e risposta HTTP/SSE, inclusi errori e conflitti; verificare con sessioni Master, autore e secondo Player che un tiro segreto non compaia mai nei payload del secondo Player, mentre un tiro pubblico compaia a tutti.

## 2. Superficie di sessione

- [x] 2.1 Riorganizzare `App.tsx` e gli stili in mappa a sinistra e pannello destro richiudibile da circa 25% su desktop; verificare a viewport desktop che la mappa occupi circa 75% e resti utilizzabile a pannello chiuso.
- [x] 2.2 Creare le quattro tab accessibili, spostare log, tracker e legenda nei rispettivi contenuti e predisporre una sezione inferiore stabile per dadi e comandi; verificare navigazione da tastiera, stato attivo e disponibilità dei dadi dopo ogni cambio tab.
- [x] 2.3 Nascondere dalla GUI i controlli di sessione, azioni e luce non richiesti, senza eliminarne il codice; mantenere nella board zoom, selettore scena e restrizioni di ruolo, verificando che il Player non acquisisca controlli Master.
- [x] 2.4 Aggiungere la tab Personaggi usando il roster corrente e la localizzazione del token solo quando disponibile; verificare che nome, immagine e azione corretta compaiano per personaggi con e senza token.
- [x] 2.5 Adattare il pannello a schermi stretti come overlay chiudibile; verificare a viewport mobile che mappa, apertura/chiusura, quattro tab e controlli dei dadi in basso restino utilizzabili da mouse e tastiera.
- [x] 2.6 Conservare in `Board.tsx` Zoom in/out, Ctrl+trascinamento o tasto centrale per spostare la visuale e il trascinamento dei token autorizzati; verificare queste interazioni con pannello aperto e chiuso e che un Player non possa trascinare token altrui.

## 3. Interazioni dadi e iniziativa

- [x] 3.1 Adattare `DicePanel` a controlli a click integrati nella sezione inferiore del pannello: click sinistro aggiunge il dado, click destro lo rimuove e la selezione si azzera dopo il tiro; aprire una modale compatta sulla superficie della mappa per modificatore positivo o negativo, modalità e visibilità; inviare la sola richiesta al nuovo endpoint e far coincidere il tiro con il log restituito dal server.
- [x] 3.2 Collocare textarea `/r` a tutta larghezza sotto i dadi e il log autorizzato, scorrevole e ordinato dal più remoto al più recente, nella tab Chat + Dadi; aggiornare la legenda, inviare con Invio, mostrare un errore per comandi invalidi e distinguere i tiri segreti per i destinatari.
- [x] 3.3 Presentare nella tab iniziativa l'ordine esistente, turno attivo, round e stato vuoto senza introdurre tiri dalla scheda o nuove regole di inserimento.
- [x] 3.4 Derivare dal vero ordine di iniziativa un segnale di transizione per ciascun Player e mostrare modali accessibili «Sei il prossimo!»/«Tocca a te!» una sola volta, senza rivelare token nascosti.

## 4. Verifica integrata

- [ ] 4.1 Eseguire `npm run build` e la verifica multi-client desktop/mobile con Master e due Player: tab, zoom e interazioni mouse della mappa, controlli dadi fissi in basso con configurazione modale sulla mappa, tiri click/comando pubblici e segreti, avvisi di turno e assenza di chat/schede non previste; registrare gli esiti e correggere eventuali regressioni.
