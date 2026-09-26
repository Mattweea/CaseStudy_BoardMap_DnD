## 1. Modulo condiviso e modello

- [x] 1.1 Creare `shared/token-conditions.mjs` con cataloghi, `SPEED_ZERO_CONDITIONS`, `effectiveSpeed`, `standUpCost` e `movementBudget` (design, decisione 2). Verifica: nuovo `test/token-conditions.test.mjs` copre ogni condizione a velocità 0, Indebolimento 1/2/4/5/6, arrotondamento per difetto con velocità 5 (dimezzata a 2, «Alzati» costa 2), budget 0 con scatto e movimento extra a velocità 0.
- [x] 1.2 Aggiornare `TokenCondition`, aggiungere `exhaustionLevel` in `src/types/index.ts` e riesportare in `src/utils/tokens.ts` i cataloghi condivisi con le etichette italiane, rimuovendo i duplicati client. Verifica: `npm run build`.
- [x] 1.3 Normalizzare condizioni ed `exhaustionLevel` su server e client (filtro per tipo, deduplicazione, limite 0-6, rimozione di `dead`/`conditioned`/`inspired`). Verifica: casi in `test/token-conditions.test.mjs` per snapshot con Morto e Prono (resta Prono, Indebolimento 0), commit a stato pieno con `pippo` (scartato), Ribaltato su un Player (scartato), veicolo e oggetto.
- [x] 1.4 Aggiungere a `pathCost` il parametro opzionale `stepCostMultiplier`, predefinito 1. Verifica: `test/grid-movement.test.mjs` controlla che i risultati esistenti non cambino e aggiunge due caselle strisciando (4) e due diagonali 5-10-5 strisciando (6).

## 2. Server

- [x] 2.1 Implementare `POST /api/battle-map/token-conditions` (design, decisione 3): autorizzazione Master/proprietario compreso il famiglio, validazione, applicazione sulle condizioni correnti, `unconscious` che porta `prone`, no-op senza incremento di versione, broadcast, azione inversa per l'Adventurer e annullamento a snapshot per il Master. Verifica: nuovo `test/token-conditions-routes.test.mjs` copre modifiche contemporanee di Master e Adventurer (entrambe presenti), token altrui (403), famiglio accettato, catalogo sbagliato e livello 7 rifiutati, svenimento e risveglio, annullamento dopo una modifica del Master che conserva Avvelenato.
- [x] 2.2 Far ignorare `conditions` a `updateOwnedToken`. Verifica: test di route in cui un Adventurer invia un elenco completo e le condizioni non cambiano, mentre HP e gli altri campi ammessi continuano ad aggiornarsi.
- [x] 2.3 Implementare `POST /api/battle-map/stand-up` (design, decisione 4) con la sua azione inversa. Verifica: casi di test per round avviato (velocità 5, usato 2, residuo 3), movimento insufficiente (servono 3, restano 2), Privo di sensi rifiutato citando la condizione, fase di tiro rifiutata, Esplorazione senza costo, Master senza costo, annullamento che rimette Prono e restituisce il movimento.
- [x] 2.4 Usare in `moveOwnedToken` la velocità effettiva, il rifiuto a velocità 0 in ogni modalità con motivo e `stepCostMultiplier` per la creatura prona mossa dall'Adventurer, lasciando invariati veicoli e Master. Verifica: estendere `test/battle-map-movement.test.mjs` con Afferrato in Esplorazione rifiutato, Trattenuto con scatto rifiutato, Indebolimento 2 (budget 2, 4 con scatto), veicolo guidato da un conducente Afferrato accettato, strisciare oltre il budget rifiutato, Master libero.

## 3. Client

- [x] 3.1 Aggiungere al hook le mutazioni per le condizioni e per «Alzati», con aggiornamento ottimistico, riallineamento in caso di rifiuto e motivo mostrato nel toast esistente. Verifica: `npm run build`; manuale con un rifiuto (Adventurer che prova «Alzati» senza movimento sufficiente) e stato riallineato.
- [x] 3.2 Creare `TokenRadialMenu` e il pannello `+`: apertura con click destro, `S` e `Shift+F10` alle condizioni previste, voci per tipo di token, «Alzati» solo su un token prono, nessuna voce di modifica, ruoli ARIA, frecce ed `Esc` con restituzione del fuoco. Verifica: manuale con mouse e sola tastiera, come Master e come Adventurer, contro gli scenari «Menu radiale del token» e «Menu accessibile da tastiera» (incluso il click destro durante la pianificazione, che resta un waypoint, e `s` nella textarea, che non apre nulla); `npm run build`.
- [x] 3.3 Aggiornare la pianificazione del movimento con velocità effettiva, costo raddoppiato strisciando e testo di suggerimento che nomina la condizione limitante o lo strisciare. Verifica: manuale a round avviato su due client: costo mostrato uguale a quello addebitato con Prono e con Indebolimento 2.
- [x] 3.4 Sostituire le icone di `ConditionBadge` con quelle di game-icons.net, limitare i badge sul token a tre più «+N» con il livello di Indebolimento, aggiungere il nome accessibile completo, la semitrasparenza per Invisibile e l'attribuzione aggiornata nella tab Impostazioni. Verifica: manuale con cinque condizioni su un token (tre badge e «+2», elenco completo letto dallo screen reader) e con Invisibile visto da un secondo Adventurer (token visibile e semitrasparente).
- [x] 3.5 Aggiungere click destro, `S` e `Shift+F10` alla legenda dei comandi, e togliere dalla legenda ogni riferimento all'apertura della modale di modifica. Verifica: manuale nella tab Legenda.
- [x] 3.6 Nascondere la modale di modifica (design, decisione 8): `TOKEN_EDIT_MODAL_ENABLED = false` in `App.tsx`, nessun callback di modifica passato a `Board`, `InitiativePanel` ed `ElementsListModal`, doppio click inerte sul token. `EditElementModal` resta invariato. Verifica: manuale come Master e come Adventurer su tutti i punti d'ingresso (doppio click e click destro su token e gruppi, click destro su una voce del tracker, elenco degli elementi): nessuna modale si apre; `npm run build` passa e il componente resta importato.

- [x] 3.7 Rifinire `TokenRadialMenu` (design, decisione 6): Prono sempre interruttore (disattivabile senza costo) e «Alzati» come azione con costo e tasto L accanto a «Scatto», fuoco che passa a Prono quando «Alzati» sparisce, spunta sullo stato attivo, etichetta sotto la corona con nome, stato e tasto, veicolo a sinistra e destra, selettore −/+ di Indebolimento raggiungibile con le frecce, tasti d'accesso e `0`-`6`, propagazione dei tasti fermata nel menu, corona e pannello dentro lo stage con il pannello accanto al token; legenda aggiornata con i tasti d'accesso. Verifica: `npm run build`; manuale come Master e Adventurer contro gli scenari «Alzarsi con il proprio movimento», «Rialzato da un alleato», «Token al bordo della mappa», «Condizione con il tasto d'accesso» e «Frecce nel menu».
- [x] 3.8 Rifiniture della barra in basso e del click destro:
  - in pianificazione il click destro annulla come `Esc`, senza aprire il menu radiale;
  - barra degli strumenti e avvisi non coprono più le lettere della griglia né lo zoom;
  - la pillola con regola e unità lascia il posto alla guida dei gesti, che a video omette distanza e residuo, già scritti sul percorso, e li conserva per lo screen reader.

  Verifica: `npm run build`; manuale con click destro su token e su mappa libera durante una pianificazione (nessuna richiesta, nessun menu, menu al secondo click destro), posizione della barra rispetto a lettere e zoom, e guida senza misure a video ma con misure nella live region.

## 4. Documentazione e verifica finale

- [x] 4.1 Aggiornare:
  - `Docs/ai/gameplay/token_and_vehicle_rules.md`: cataloghi, `exhaustionLevel`, Invisibile come marcatore distinto da `isInvisible`, operazioni singole;
  - `Docs/ai/gameplay/combat_movement_and_dice.md`: velocità effettiva, «Alzati», strisciare;
  - `Docs/ai/backend/shared_state_and_persistence.md`: normalizzazione, nuovi endpoint, azioni di annullamento `token-conditions` e `stand-up`;
  - `Docs/ai/frontend/board_interaction_and_visibility.md`: menu radiale, click destro fuori da una pianificazione, `S` e `Shift+F10`, modale di modifica nascosta e come riattivarla;
  - la sezione P0.8 di `FEATURES_VTT.md`.

  Verifica: `npm run docs:check` e `git diff --check` passano.
- [x] 4.2 Eseguire `npm test`, `npm run build` e `openspec validate p0-8c-token-conditions --strict --no-interactive`. Verifica: tutti passano.
- [x] 4.3 Verifica end-to-end su Master e due Adventurer:
  - Master e Adventurer aggiungono condizioni allo stesso token quasi insieme e nessuna va persa;
  - un Adventurer diventa Privo di sensi (e quindi prono), il Master lo risveglia, lui si alza a round avviato e paga metà della velocità;
  - un Adventurer prono striscia pagando il doppio;
  - un token Afferrato non si muove nemmeno in Esplorazione;
  - uno snapshot con Morto si carica pulito;
  - suspend e resume conservano condizioni e Indebolimento.

  Verifica: l'esito di ogni scenario è riportato nel riepilogo della change.
- [x] 4.4 Aggiornare `Docs/ai/frontend/board_interaction_and_visibility.md` per la rifinitura del menu (Prono interruttore senza costo e «Alzati» come azione con costo, tasti d'accesso, propagazione fermata, posizionamento dentro lo stage). Verifica: `npm run docs:check` e `git diff --check` passano.

## Riepilogo della verifica

Verifica end-to-end del 2026-09-26 in Chrome automatizzato: server isolato con dati di sessione in una cartella temporanea, Master e due Adventurer (Ilthar, Thalendir) in contesti separati. Esito: tutti gli scenari passano.

- **3.1:** «Alzati» a round avviato con 1 casella residua viene rifiutato con «Alzarsi costa 3 caselle: ne restano 1 in questo round.»; il token resta Prono sul server e nel DOM.
- **3.2:**
  - click destro, `S` e `Shift+F10` aprono il menu con il fuoco sulla prima voce, ed `Esc` ridà il fuoco al token;
  - durante la pianificazione il click destro non apre il menu (dal 3.8 annulla la pianificazione, invece di aggiungere un waypoint);
  - `s` nella textarea dei dadi non apre nulla;
  - l'etichetta resta vuota all'apertura e compare dopo una freccia.
- **3.3:**
  - strisciando, 1 casella addebita 2 e il residuo mostrato (0 caselle percorribili strisciando) coincide con quello del server;
  - con Indebolimento 2, 2 caselle costano 2 su un budget di 3, e il percorso oltre il budget è segnalato come «Fuori budget» e rifiutato senza addebito.
- **3.8:**
  - il click destro su un token durante la pianificazione (con un waypoint) la annulla: nessun percorso, nessuna richiesta, nessun menu;
  - un secondo click destro apre il menu, e anche il click destro su mappa libera annulla;
  - la guida a video non ha misure, mentre la live region contiene «Percorso 6 caselle…»;
  - gli strumenti partono a 83px, oltre la colonna delle lettere che finisce a 73px, e la guida finisce prima dello zoom;
  - la pillola della regola non c'è più.
- **3.4:**
  - quattro condizioni con Indebolimento 2 danno tre badge e «+2», con elenco completo nel nome accessibile;
  - Invisibile resta visibile per un altro Adventurer, con opacità 0,55;
  - l'attribuzione delle icone compare in Impostazioni.
- **3.5:** la legenda elenca click destro, `S`, `Shift+F10`, i tasti d'accesso, `L` e `0`-`6`, senza riferimenti alla modale.
- **3.6:** il doppio click (Master e Adventurer), il click destro sulle voci del tracker e l'elenco degli elementi non aprono la modale di modifica. Il click destro sui gruppi di ostacoli non è stato provato.
- **4.3:**
  - Master e Adventurer aggiungono Afferrato e Avvelenato in parallelo, ed entrambe restano;
  - Privo di sensi aggiunge Prono, il risveglio lo conserva e «Alzati» addebita 3 caselle con velocità 6;
  - strisciare costa il doppio, come per il 3.3;
  - Afferrato in Esplorazione viene rifiutato con «Non puoi muoverti: Afferrato porta la tua velocità a 0.»;
  - uno snapshot con Morto, Prono e Condizionato si carica con il solo Prono e Indebolimento 0;
  - suspend e resume conservano Avvelenato e Indebolimento 2.
