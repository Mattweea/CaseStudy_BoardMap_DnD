## Context

Vedi `proposal.md — Why` per la motivazione. I vincoli che danno forma all'approccio:

- Il movimento autorevole vive in `moveOwnedToken` (`server/index.mjs`), che oggi riceve solo `tokenId`, `x`, `y`. Il costo del turno è contabilizzato in due campi paralleli dello stato condiviso: `movementUsedByTokenId` (il numero mostrato) e `movementAxisUsageByTokenId` (`{ horizontal, vertical }`, la fonte reale). `movementUsedFromAxisUsage` ne prende il massimo: è questa funzione a produrre lo sconto sui percorsi spezzati.
- Il controllo degli ostacoli, `findBlockedMovement`, cammina già passo per passo da `from` a `to` con `Math.sign` e `max(|dx|, |dy|)` iterazioni, quindi tratta implicitamente una mossa come un segmento rettilineo con diagonali. Riusarlo per segmento è naturale.
- Il client non ha uno stato di percorso: `Board.tsx` modella l'interazione come unione discriminata (`pan`, `pending-token`, `drag`, `select-box`, `obstacle-paint`) e `drag` porta solo `hoverCell`. Durante il trascinamento il token segue il puntatore e nessun costo è mostrato.
- Il client scarta il motivo di un movimento rifiutato: `performOwnedMove` (`useBattleMapState.ts`) registra l'errore in console e ripristina lo snapshot precedente, quindi il token torna indietro senza alcuna spiegazione visibile.
- Esiste già un precedente per la logica condivisa senza build: `shared/dnd-rules.mjs` più `shared/dnd-rules.d.ts`, importato da Node e da Vite. P0.5 lo ha introdotto proprio per impedire che client e server divergano su un calcolo.
- Esiste già un precedente per gli eventi SSE effimeri e filtrati per destinatario: `broadcastCharacterSheetEvent` invia eventi nominati (`event: <tipo>`) sullo stesso stream dello snapshot, e il client li rilancia come `CustomEvent` (`useBattleMapState.ts`). Lo snapshot resta il canale del solo stato autorevole.
- La scena non esiste come entità: nessun modello, nessuna dimensione, nessuna unità. `BOARD_CONFIG.cellSize` è una costante di rendering in pixel, non una scala di gioco.
- Il movimento degli Adventurer è già annullabile con azioni inverse per utente (`pushPlayerUndoAction`), che memorizzano `previousMovementAxisUsage`.

## Goals / Non-Goals

**Goals:**

- Una sola funzione, condivisa fra client e server, che dato un percorso e una regola restituisce il costo e i passi che lo compongono. Nessuna seconda implementazione della stessa aritmetica.
- Il percorso come unità di trasporto del movimento: quel che l'utente vede misurato è letteralmente ciò che il server riceve e rivaluta.
- Gli strumenti effimeri (righello, sagome, ping) fuori dallo stato autorevole, quindi fuori da versione, undo, snapshot e persistenza.

**Non-Goals:**

- Non si introduce un modello di scena. Regola delle diagonali e unità sono campi della partita e P0.9 le sposterà.
- Non si introduce pathfinding, né sul client né sul server.
- Non si tocca la logica di iniziativa e turni: il budget si legge come già avviene.
- Non si cambia il rendering della mappa né il sistema di coordinate.

## Decisions

### Nuovo modulo `shared/grid-movement.mjs`, non un'estensione di `dnd-rules`

Il costo del movimento è geometria di griglia, non regole di personaggio: mescolarlo a `dnd-rules.mjs` renderebbe quel modulo una discarica. Il nuovo modulo espone la decomposizione di un segmento in passi, il costo di un percorso data la regola e lo stato di alternanza iniziale, e la conversione caselle/unità. Segue le stesse convenzioni: `.mjs` puro più `.d.ts` scritto a mano, nessuna dipendenza, nessuna build.

La funzione centrale è pura e restituisce sia il costo sia l'alternanza finale, perché il chiamante deve poter riprendere il conteggio da dove l'ha lasciato:

```
pathCost(waypoints, { rule, diagonalParity }) -> { cells, steps, nextDiagonalParity }
```

*Alternativa scartata:* calcolare il costo dentro `server/index.mjs` ed esporre un endpoint di misura al client. Aggiunge un round-trip per ogni movimento del puntatore e riporta esattamente il problema che il modulo condiviso esiste per evitare.

### Il parity dell'alternanza è stato di turno, non stato di percorso

La variante 5-10-5 conta le diagonali del turno, non quelle del singolo spostamento: due movimenti separati nello stesso turno devono continuare la stessa alternanza. Il parity diventa quindi un campo dello stato condiviso accanto al movimento usato — `diagonalParityByTokenId: Record<string, 0 | 1>` — azzerato negli stessi punti in cui oggi si azzerano `movementUsedByTokenId` e `movementAxisUsageByTokenId` (cambio di round, pulizia dell'iniziativa).

Il client ne ha bisogno per mostrare il costo corretto durante il trascinamento, quindi il campo viaggia nello snapshot come gli altri.

*Alternativa scartata:* ricalcolare il parity dalla storia dei movimenti del turno. Richiederebbe di conservare quella storia, che oggi non esiste.

### `movementAxisUsageByTokenId` viene rimosso, `movementUsedByTokenId` diventa la fonte

Tenere il conteggio per asse accanto a un costo di percorso significa avere due verità di cui una sbagliata. `movementUsedByTokenId` esiste già, è già nello snapshot e già mostrato: diventa la fonte e viene incrementato del costo del percorso appena validato.

La normalizzazione di uno snapshot vecchio converte `movementAxisUsageByTokenId` in un numero con la vecchia regola — `max(horizontal, vertical)` — solo quando `movementUsedByTokenId` non ha già un valore per quel token, e poi lo scarta. È una conversione conservativa: nessun personaggio si ritrova a metà turno con più movimento speso di quanto ne avesse speso prima del riavvio.

L'azione inversa di undo sostituisce `previousMovementAxisUsage` con `previousMovementUsed` e `previousDiagonalParity`.

### Il percorso viaggia come waypoint, con compatibilità per la destinazione singola

`POST /api/battle-map/move` accetta `waypoints: GridPosition[]` in alternativa a `x`/`y`. Il payload `x`/`y` resta valido e viene trattato come un percorso di un solo segmento dalla posizione corrente: è ciò che serve al movimento da tastiera, che muove di una casella per volta, e a `moveTokens` del Master.

Il server valida i waypoint prima di usarli: array non vuoto, entro un tetto di elementi, coordinate intere non negative, primo segmento che parte dalla posizione corrente del token. Poi, per ogni segmento, riusa `findBlockedMovement` e il controllo di sovrapposizione già esistenti, e somma i costi con `pathCost`.

*Alternativa scartata:* un nuovo endpoint `/api/battle-map/move-path`. Due rotte per la stessa operazione duplicherebbero autorizzazione, budget, undo e broadcast.

### Una sola modalità di movimento, `plan`, con due modi di confermarla

`DragInteraction` sparisce: `Board.tsx` ha una sola `PlanInteraction` per ogni ruolo, con la lista dei waypoint, lo scostamento di presa e gli scostamenti dei token del gruppo. Il righello resta uno stato separato (`rulerWaypoints`) perché non appartiene a nessun token, ma alimenta lo stesso componente di resa e la stessa chiamata a `pathCost`.

Il token **non segue il puntatore**: resta disegnato alla posizione di partenza mentre il percorso misurato la precede, e la destinazione è mostrata dall'evidenziazione. Si vede così da dove si è partiti, che è l'informazione che serve per decidere se il percorso conviene.

Il click ha **un solo significato**, aggiungere un punto al percorso: quello sul token apre la pianificazione e lo seleziona, quelli successivi spezzano il percorso. La destinazione non si clicca — è la casella sotto il puntatore quando si preme `Spazio`, che è l'unico gesto di conferma. `Backspace` toglie l'ultimo waypoint, `Esc` annulla.

Un percorso diretto costa quindi un click e un tasto; un percorso a L costa due click e un tasto. L'ultimo click della vecchia formulazione, quello sulla destinazione, spariva subito dopo essere stato fatto: era lavoro senza informazione.

*Alternativa scartata:* lasciare al Master il trascinamento e al Player la pianificazione a click, come nella prima stesura di questa change. Due gesti diversi per la stessa azione allo stesso tavolo: il Master non può mostrare a voce come si muove un token, perché lui lo muove in un altro modo, e non vede mai la misura che i suoi giocatori vedono.

*Alternativa scartata:* far confermare il rilascio del pointer per chi entra trascinando. Il rilascio sarebbe stato un secondo significato del gesto di puntamento — a volte un waypoint, a volte una mossa inviata — e la differenza dipendeva da come si era entrati nella pianificazione, cioè da qualcosa che l'utente non vede più nel momento in cui conferma. Premere e trascinare ora apre semplicemente il percorso; il rilascio non fa nulla.

*Conseguenza sulla selezione:* un click su un token che si può muovere lo seleziona **e** apre il percorso. Non è distruttivo — finché non si preme `Spazio` nulla si muove, e `Esc` lascia il token selezionato dov'era — quindi non serve un secondo click per cominciare. `Shift`+click resta pura selezione multipla.

### Il motivo di un rifiuto arriva a chi ha mosso

`moveOwnedToken` distingue già budget insufficiente, ostacolo e destinazione occupata nel messaggio di errore. Il client lo mette in un `MovementNotice` — `{ id, message }`, fuori dallo stato condiviso perché riguarda solo chi ha inviato la richiesta — che la mappa mostra come avviso finché non viene chiuso. Senza di esso il token torna indietro da solo e il rifiuto sembra un errore dell'applicazione.

L'`id` cambia a ogni rifiuto così che due rifiuti con lo stesso testo restino due eventi distinti.

### `token-walk`: l'animazione parte dall'accettazione, non dalla richiesta

Quando un movimento è accettato, il server trasmette `token-walk` con il percorso a chi già vede quel token, riusando lo stesso filtro di visibilità delle sagome. Ogni client, incluso quello che ha mosso, anima la camminata da quell'evento.

Anticipare l'animazione in locale al momento della conferma farebbe camminare il token per intero anche quando la mossa viene poi rifiutata, e il ritorno indietro sembrerebbe un difetto invece di un rifiuto. Far partire tutti dallo stesso evento costa una latenza di rete e in cambio rende impossibile animare un movimento che non è avvenuto.

L'evento è puramente presentazionale: non tocca `battleMapState`, la versione né lo snapshot, esattamente come ping e sagome.

### Sagome e ping sono eventi SSE nominati, mai stato condiviso

`ephemeral-ping` e `ephemeral-template` seguono il modello di `character-sheet-events.mjs`: evento nominato sullo stesso stream, filtrato per destinatario nel momento dell'invio, mai scritto in `battleMapState`, mai versionato, mai incluso in uno snapshot. Non toccano `bumpBattleMapVersion` né `broadcastSnapshot`.

Due rotte, `POST /api/battle-map/ping` e `POST /api/battle-map/template`, autenticano il chiamante, ne derivano l'autore dalla sessione, validano tipo e geometria e ritrasmettono. La scomparsa è governata dal client: il ping ha una durata fissa, la sagoma termina quando il suo autore invia l'evento di fine. Un autore che si disconnette senza inviare la fine lascia una sagoma appesa, quindi la sagoma ha comunque una durata massima oltre la quale il client la rimuove.

La sagoma è trasmessa a chi già potrebbe vederne l'origine: il filtro riusa la stessa sanitizzazione che decide se un token è visibile a quel destinatario. È una precauzione, non una funzione di segretezza — P0.10 governa i segreti.

*Alternativa scartata:* mettere ping e sagome nello stato condiviso con una scadenza. Ogni ping farebbe incrementare la versione, entrerebbe nell'undo del Master e finirebbe negli snapshot suspend/resume.

### Regola e unità sono due campi della partita, non una tabella di impostazioni

`diagonalRule: 'standard' | 'alternating'` e `measurementUnit: { label: string; cellsValue: number }` entrano in `BattleMapSharedState` con i valori predefiniti `'standard'` e `{ label: 'm', cellsValue: 1.5 }`. La modifica passa da una rotta riservata al Master. Sono due campi perché sono due impostazioni: una terza rotta di impostazioni generiche inviterebbe a farne passare altre senza validazione dedicata.

## Risks / Trade-offs

- **Il costo corretto è una regressione percepita.** Un tavolo abituato allo sconto sui percorsi a L vedrà i propri personaggi muoversi di meno. → La change è dichiarata BREAKING nel proposal; la nota di rilascio deve dirlo esplicitamente, e la misura visibile prima della conferma rende il nuovo costo comprensibile invece che sorprendente.
- **Rimuovere `movementAxisUsageByTokenId` rompe uno snapshot a metà turno.** → La normalizzazione converte il campo vecchio prima di scartarlo, e il caso è coperto da un requisito e da uno scenario di compatibilità. Il rischio residuo è un turno in corso che riparte con un costo leggermente diverso: accettabile, perché il valore vecchio era comunque sbagliato.
- **Il client può inviare un percorso assurdo** — mille waypoint, o un percorso che serpeggia per consumare budget altrui. → Tetto sul numero di waypoint e sul costo totale per richiesta; il costo è comunque limitato dal budget residuo, che il server verifica.
- **Un evento effimero può arrivare a chi non deve vederlo** se il filtro delle sagome diverge da quello dello stato. → Il filtro riusa la funzione di sanitizzazione esistente invece di reimplementarla, e la verifica include un client Adventurer che non deve ricevere una sagoma originata su un token invisibile.
- **Il parity dell'alternanza si disallinea fra client e server** dopo un rifiuto o una riconnessione, mostrando un costo diverso da quello addebitato. → Il parity è nello snapshot e il server è l'unica fonte; il client lo rilegge a ogni snapshot invece di mantenerne una copia propria.
- **Il modulo condiviso cresce oltre il suo scopo.** → Espone solo funzioni pure su coordinate e regole; non conosce token, permessi, né stato della partita.
- **Il Master perde il trascinamento a cui è abituato.** Unificare su `plan` cambia il gesto più usato dal ruolo che lo usa di più. → Il trascinamento resta il modo principale di entrare in pianificazione e il rilascio continua a confermare: cambia che il token non segue più il puntatore e che il costo è visibile. La riga dei suggerimenti dichiara il gesto in corso.
- **`token-walk` mostra un percorso a chi non dovrebbe vederlo.** → Riusa `isTokenVisibleToUser`, lo stesso filtro dello stato e delle sagome, e trasmette solo il percorso di un token già visibile a quel destinatario.

## Migration Plan

1. Introdurre `shared/grid-movement.mjs` e i suoi test prima di toccare il server: la funzione è pura e verificabile da sola.
2. Aggiungere i campi nuovi allo stato condiviso con valori predefiniti su entrambi i lati, e la conversione di `movementAxisUsageByTokenId` in normalizzazione, prima di rimuoverne l'uso.
3. Sostituire il conteggio in `moveOwnedToken`, mantenendo `x`/`y` accettati.
4. Aggiungere i waypoint al payload e la validazione per segmento.
5. Solo allora il client: percorso misurato, modalità `plan` unificata, righello, motivo del rifiuto, impostazioni del Master.
6. Per ultimi ping, sagome e `token-walk`, che non dipendono da nulla di quanto sopra.

Rollback: i passi 6 e 5 sono rimovibili da soli. Un rollback dei passi 2-4 richiede di ripristinare il conteggio per asse; poiché `movementUsedByTokenId` esiste già in entrambe le versioni, uno snapshot scritto dalla nuova versione si carica nella vecchia con il movimento usato conservato e l'alternanza ignorata.
