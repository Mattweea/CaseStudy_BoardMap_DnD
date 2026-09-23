## 1. Modulo condiviso del costo di percorso

- [x] 1.1 Creare `shared/grid-movement.mjs` con la decomposizione di un segmento in passi (diagonali per la differenza minore fra gli assi, poi ortogonali residui) e verificare con test su segmento ortogonale, diagonale puro e obliquo che la sequenza di passi copra esattamente la differenza di coordinate.
- [x] 1.2 Implementare `pathCost(waypoints, { rule, diagonalParity })` che restituisce `{ cells, steps, nextDiagonalParity }` e verificare con test: percorso a L di 3+3 uguale a 6 con entrambe le regole, 3 diagonali uguali a 3 con `standard` e 4 con `alternating`, percorso vuoto o di un solo punto uguale a 0.
- [x] 1.3 Coprire con test la continuità dell'alternanza fra chiamate: due chiamate consecutive con `diagonalParity` ripreso dalla precedente devono dare lo stesso totale di una chiamata unica sullo stesso percorso.
- [x] 1.4 Aggiungere la conversione caselle/unità (`cellsToUnit`) e verificare con test che 6 caselle a `1,5` per casella diano 9 e che un valore per casella non positivo o non numerico sia respinto.
- [x] 1.5 Scrivere `shared/grid-movement.d.ts` sul modello di `shared/dnd-rules.d.ts` e verificare che `npm run build` compili con il modulo importato sia da `src/` sia da `server/`.

## 2. Stato condiviso: regola, unità e alternanza

- [x] 2.1 Aggiungere a `src/types/index.ts` e alla forma normalizzata del server i campi `diagonalRule`, `measurementUnit` e `diagonalParityByTokenId`, con i valori predefiniti `'standard'` e `{ label: 'm', cellsValue: 1.5 }`, e verificare che uno stato vuoto normalizzato li contenga.
- [x] 2.2 Convertire in normalizzazione `movementAxisUsageByTokenId` in `movementUsedByTokenId` con la vecchia regola `max(horizontal, vertical)`, solo quando il token non ha già un valore, e poi scartare il campo; verificare con un test che carica uno snapshot pre-change con un turno in corso e conferma movimento usato conservato e budget residuo non negativo.
- [x] 2.3 Rimuovere `calculateMovementAxisUsage` e `movementUsedFromAxisUsage` da `server/index.mjs` e ogni residuo di `movementAxisUsageByTokenId` da client e server, verificando con una ricerca nel repository che non restino occorrenze fuori dalla normalizzazione di compatibilità.
- [x] 2.4 Azzerare `diagonalParityByTokenId` negli stessi punti in cui oggi si azzera `movementUsedByTokenId` (wrap del round, pulizia dell'iniziativa) e verificare con un test sul ciclo dei turni che l'alternanza non attraversi il cambio di round.
- [x] 2.5 Aggiungere la rotta riservata al Master che imposta regola delle diagonali e unità, con validazione del valore per casella come numero positivo, e verificare con test che un Adventurer riceva 403 senza modificare lo stato e che un valore per casella pari a zero o negativo sia rifiutato.

## 3. Movimento autorevole con percorso

- [x] 3.1 Estendere `POST /api/battle-map/move` per accettare `waypoints` in alternativa a `x`/`y`, trattando `x`/`y` come percorso di un solo segmento, e verificare con test che entrambi i payload producano lo stesso risultato su una mossa rettilinea.
- [x] 3.2 Validare i waypoint sul server — array non vuoto, entro un tetto di elementi, coordinate intere non negative, primo segmento che parte dalla posizione corrente del token — e verificare con test che ogni violazione restituisca 400 senza spostare il token.
- [x] 3.3 Sostituire in `moveOwnedToken` il conteggio per asse con `pathCost` sulla regola corrente e sul parity del token, incrementando `movementUsedByTokenId` e aggiornando `diagonalParityByTokenId`; verificare con test che un percorso a L di 3+3 addebiti 6 caselle e che 3 diagonali addebitino 3 o 4 secondo la regola.
- [x] 3.4 Estendere il controllo degli ostacoli e della sovrapposizione a ogni segmento del percorso riusando `findBlockedMovement`, e verificare con test che un percorso con destinazione libera ma segmento intermedio bloccato sia rifiutato con il motivo dell'ostacolo e senza spostamento parziale.
- [x] 3.5 Ignorare qualunque costo o distanza proposta dal client e verificare con un test che una richiesta che dichiara un costo inferiore al reale venga addebitata del costo ricalcolato e rifiutata se supera il budget residuo.
- [x] 3.6 Confermare con un test che il server non proponga né applichi una rotta alternativa quando il percorso attraversa un ostacolo, e che il movimento del Master resti esente da budget e blocchi.
- [x] 3.7 Sostituire nell'azione inversa di undo `previousMovementAxisUsage` con `previousMovementUsed` e `previousDiagonalParity`, e verificare con test che l'annullamento ripristini posizione, movimento usato e alternanza, e che un utente non possa annullare il movimento di un altro.

## 4. Percorso misurato e righello sul client

- [x] 4.1 Sostituire `DragInteraction` in `src/components/Board.tsx` con un'unica `PlanInteraction` per ogni ruolo, con waypoint, scostamento di presa e scostamenti del gruppo; verificare sull'app che il percorso segua i punti scelti.
- [x] 4.2 Rendere il percorso con il costo di ogni segmento accanto al segmento e il totale sulla punta, in caselle e nell'unità della partita, usando `pathCost` del modulo condiviso e portando avanti l'alternanza di segmento in segmento; verificare sull'app che il valore mostrato coincida con quello addebitato dal server alla conferma.
- [x] 4.3 Mostrare durante la pianificazione il budget residuo del turno e segnalare prima della conferma destinazione fuori budget, segmento bloccato e destinazione occupata, in forma testuale oltre che con il colore; verificare l'accessibilità del segnale secondo `Docs/ai/frontend/board_interaction_and_visibility.md`.
- [x] 4.4 Annullare la pianificazione con `Esc` e togliere l'ultimo waypoint con `Backspace`, senza inviare alcuna richiesta, e verificare sull'app che il token resti nella posizione di partenza e il budget non cambi.
- [x] 4.5 Inviare i waypoint dal percorso confermato attraverso `moveToken` in `src/hooks/useBattleMapState.ts`, mantenendo il movimento da tastiera sul payload a casella singola, e verificare che entrambi i percorsi di input passino dalla stessa rotta autorevole.
- [x] 4.6 Aggiungere lo strumento righello con i suoi waypoint, disponibile a ogni ruolo e indipendente dai permessi sui token, e verificare sull'app che misuri fuori turno senza spostare token né consumare budget.
- [x] 4.7 Rendere righello e uscita con `Esc` raggiungibili da tastiera insieme agli altri controlli di mappa, con il pannello destro aperto e richiuso, e verificare la navigazione da tastiera su entrambe le configurazioni.
- [x] 4.8 Aggiungere i controlli Master per regola delle diagonali e unità di misura, mostrando il valore corrente a tutti i partecipanti, e verificare sull'app che il cambio si rifletta subito su righello e misura del trascinamento in un secondo client.

## 5. Sagome e ping effimeri

- [x] 5.1 Aggiungere `POST /api/battle-map/ping` e `POST /api/battle-map/template` che autenticano il chiamante, ne derivano l'autore dalla sessione e validano tipo e geometria; verificare con test che un autore proposto dal client sia ignorato e che una geometria non valida sia rifiutata.
- [x] 5.2 Distribuire i due eventi come eventi SSE nominati sul modello di `server/character-sheet-events.mjs`, senza toccare `battleMapState`, la versione o lo snapshot; verificare con test che la versione dello stato non cambi e che lo snapshot non contenga traccia degli eventi.
- [x] 5.3 Filtrare la sagoma con la stessa sanitizzazione che decide la visibilità di un token per quel destinatario, e verificare con test che un Adventurer non riceva una sagoma originata su un token che non può vedere.
- [x] 5.4 Ricevere i due eventi in `src/hooks/useBattleMapState.ts` e renderli sulla mappa, con il ping a durata fissa e la sagoma terminata dal suo autore più una durata massima di sicurezza; verificare su due client che la sagoma compaia mentre viene disegnata e scompaia al rilascio.
- [x] 5.5 Implementare i tre tipi di sagoma — cerchio, cono, linea — con origine, orientamento e dimensione scelti sulla mappa e misura in caselle e nell'unità della partita, e verificare sull'app la misura di ciascuno contro il costo di percorso equivalente.
- [x] 5.6 Verificare con un test che una riconnessione dopo la scomparsa non riporti alcuna sagoma né alcun ping, e sull'app che nessun ping sposti la visuale di un altro partecipante.
- [x] 5.7 Aggiungere l'evento `token-walk`, trasmesso dopo che un movimento è stato accettato e filtrato con la stessa visibilità delle sagome, e riprodurlo sul client come camminata animata; verificare con test che non cambi la versione dello stato e che non compaia in alcuno snapshot.

## 6. Coerenza del gesto, motivo del rifiuto e accessibilità

- [x] 6.1 Unificare Master e Adventurer sulla stessa `PlanInteraction`, rimuovendo il percorso di ingresso separato del Player, e verificare sull'app che il Master veda la misura del percorso che prima non aveva e che il movimento di gruppo del Master resti applicato a tutti i token selezionati.
- [x] 6.2 Dare al click un solo significato — aggiungere un punto al percorso — facendo sì che il click sul token lo selezioni e apra la pianificazione, che la destinazione sia la casella sotto il puntatore alla conferma e che nessun rilascio di pointer invii un movimento; verificare sull'app che click-punta-`Spazio` muova il token e che premere, trascinare e rilasciare non muova nulla.
- [x] 6.9 Evidenziare sempre il centro di una sagoma, per cerchio, cono e linea, con un segno leggibile sopra qualunque colore di riempimento; verificare sull'app su un cerchio ampio e su un cono.
- [x] 6.3 Propagare il motivo del rifiuto del server fino a un avviso visibile con `role="alert"` e chiudibile, conservandolo in `MovementNotice` fuori dallo stato condiviso, e verificare sull'app i tre motivi distinti: budget, ostacolo e destinazione occupata.
- [x] 6.4 Far partire la camminata animata dall'evento `token-walk` invece che dalla conferma locale, e verificare sull'app che un movimento rifiutato non produca alcuna animazione.
- [x] 6.5 Aggiungere la riga dei suggerimenti come live region `role="status"`, con i gesti dell'interazione in corso e gli avvisi di percorso, e verificare che gli avvisi non dipendano dal solo colore.
- [x] 6.6 Limitare `Spazio` e `Backspace` della pianificazione ai casi in cui il fuoco non è in un campo di testo, e restringere la soppressione del menu contestuale al solo elemento della mappa; verificare sull'app che scrivere in un campo di testo con una pianificazione aperta non confermi il movimento e che il click destro resti disponibile fuori dalla mappa.
- [x] 6.7 Dare un nome accessibile testuale ai pulsanti degli strumenti di mappa, nascondendone le icone ai lettori di schermo, e aggiungere le scorciatoie a tasto singolo `R`, `P`, `C`, `O`, `L` inerti durante la scrittura e durante un'interazione; verificare la navigazione da tastiera.
- [x] 6.8 Ricavare l'eventuale misura in piedi dal valore in metri appena calcolato invece che da una scala fissa per casella, tenere un solo formattatore di distanza, e verificare che con una casella diversa da `1,5 m` le due misure restino coerenti.

## 7. Documentazione e verifica finale

- [x] 7.1 Aggiornare `Docs/ai/gameplay/combat_movement_and_dice.md` sostituendo la regola del massimo per asse con il costo di percorso, la regola delle diagonali e l'unità della partita.
- [x] 7.2 Aggiornare `Docs/ai/frontend/board_interaction_and_visibility.md` con le nuove modalità di interazione, i waypoint, l'uscita con `Esc` e i requisiti di accessibilità del segnale di budget.
- [x] 7.3 Aggiornare `Docs/ai/backend/shared_state_and_persistence.md` con i nuovi campi condivisi, la rimozione di `movementAxisUsageByTokenId`, la conversione degli snapshot e il confine degli eventi effimeri rispetto allo stato versionato.
- [x] 7.4 Eseguire `npm run docs:check`, `node --test` e `npm run build` e verificare che passino tutti.
- [x] 7.5 Verificare manualmente con Master e due Player in finestre distinte l'intero percorso di accettazione di P0.7: misura con righello e con trascinamento, cambio della regola delle diagonali, rifiuto per budget e per ostacolo, sagoma vista da un secondo client, ping senza spostamento della visuale, e assenza di tracce dopo un riavvio del server.
