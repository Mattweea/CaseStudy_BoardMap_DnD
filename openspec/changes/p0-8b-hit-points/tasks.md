## 1. Modulo condiviso

- [ ] 1.1 Creare `shared/hit-points.mjs` (con `.d.ts`/`.d.mts` come gli altri moduli condivisi) con `parseHitPointInput`, `readHitPointNumber`, `applyHitPointDelta`, `hitPointTransition` e `hitPointTone` (design, decisione 1). Verifica: nuovo `test/hit-points.test.mjs` copre:
  - ogni riga della tabella degli esempi: 12/5 con `-8` → 9/0, `-3` → 12/2, `-5` → 12/0; 12/0 con `-30` → 0/0; 0/4 con `-3` → 0/1; 18/5 con `+10` e massimo 20 → 20/5;
  - `+N` senza massimo e `±N` senza attuali rifiutati;
  - la sintassi (`- 8` accettato; `2d6`, `-0`, `-1000`, `+1000` rifiutati; vuoto e `7` come assoluti);
  - le transizioni `down`, `up` e nulle, compreso un valore non numerico;
  - le soglie di `hitPointTone`.

## 2. Server

- [ ] 2.1 Aggiungere le transizioni in `CharacterSheetService.applyPatch` (design, decisione 3): azzeramento dei contatori contro morte nella stessa commit sulla risalita da 0, e `hitPointTransition` passata al callback di proiezione. Verifica: casi in `test/character-sheet-service.test.mjs` per `0` scritto a mano (transizione `down`), risalita da 0 con 2 successi e 1 fallimento (contatori a 0 nella stessa versione e nell'evento SSE), valore che resta a 0 o sopra 0 (nessuna transizione né modifica dei contatori).
- [ ] 2.2 Implementare `adjustHitPoints` e `POST /api/character-sheets/:id/hit-points` (design, decisione 2). Verifica: casi in `test/character-sheet-routes.test.mjs` per:
  - proprietario e Master (accettati);
  - un altro Adventurer (`403`);
  - scheda inesistente (`404`);
  - `delta` 0, 1000 o non intero (`400`);
  - cura senza massimo e danno senza attuali (`400` con messaggio);
  - due `-5` in sequenza stretta su 12/0 (risultato 2);
  - evento SSE limitato a proprietario e Master.
- [ ] 2.3 Applicare Privo di sensi alla transizione in `projectCharacterSheetToToken`, estraendo da `applyTokenCondition` la logica senza autorizzazione (design, decisione 3). Verifica: nuovo `test/hit-points-routes.test.mjs` copre `-5` su un PG a 3 HP (token Privo di sensi e Prono, versione della mappa incrementata, broadcast), `+1` da 0 (Privo di sensi tolto, Prono conservato) e danno a chi è già a 0 (condizioni invariate).
- [ ] 2.4 Derivare gli HP del token canonico dalla scheda nel normalizzatore e togliere i campi HP da `updateOwnedToken` (design, decisione 4). Verifica: casi in `test/hit-points-routes.test.mjs` per:
  - `token-update` con HP diversi dalla scheda (ignorati);
  - commit a stato pieno del Master con HP falsi su un PG (quelli della scheda) e HP su un nemico (conservati);
  - ripresa di uno snapshot con HP disallineati (riallineati).
- [ ] 2.5 Sanitizzare gli HP dopo la normalizzazione in `sanitizeStateForUser` (design, decisione 5). Verifica: casi in `test/hit-points-routes.test.mjs` per lo snapshot HTTP e SSE di un Adventurer (HP assenti su altri PG e nemici, presenti su proprio token e famiglio) e per il Master (tutti presenti).

## 3. Client

- [ ] 3.1 Sostituire il campo «Attuali» in `CharacterTab.tsx` con il componente a conferma esplicita e aggiungere a `useCharacterSheet` la chiamata all'endpoint con flush preventivo (design, decisione 6). Verifica: `npm run build`; manuale come proprietario e come Master contro gli scenari:
  - «Danno scritto nel campo», «Nessun invio durante la digitazione» (nessuna richiesta nella scheda di rete) e «Input non valido»;
  - «Cura oltre il massimo» e «Cura senza massimo»;
  - `Esc` che ripristina il valore;
  - un secondo client che vede il nuovo valore senza ricaricare.
- [ ] 3.2 Usare `hitPointTone` in `HitPointMeter` e sostituire il testo HP di `Token.tsx` con la barra, l'etichetta al passaggio del mouse o al fuoco e il nome accessibile (design, decisione 7). Verifica: `npm run build`; manuale contro gli scenari «Barra del Master», «Barra del Player», «Numero da tastiera» e «Token senza HP massimi», con un PG a 0 HP riconoscibile in scala di grigi e il nome accessibile letto dallo screen reader.

## 4. Documentazione e verifica finale

- [ ] 4.1 Aggiornare:
  - `Docs/ai/backend/character_sheet_service_and_realtime.md`: endpoint `hit-points`, transizioni nella commit, HP del token derivati e non più modificabili dal token;
  - `Docs/ai/backend/shared_state_and_persistence.md`: sanitizzazione degli HP dopo la normalizzazione, derivazione nel normalizzatore;
  - `Docs/ai/backend/api_auth_and_realtime.md`: nuovo endpoint owner-scoped;
  - `Docs/ai/gameplay/token_and_vehicle_rules.md`: HP dei PG dalla scheda, HP di PNG e famigli sul token, transizioni verso Privo di sensi;
  - `Docs/ai/frontend/character_sheet_client_and_window.md`: campo a conferma esplicita e `±N`;
  - `Docs/ai/frontend/board_interaction_and_visibility.md`: barra della vita e visibilità per ruolo;
  - la sezione P0.8 di `FEATURES_VTT.md` (voci e stato attuale).

  Verifica: `npm run docs:check` e `git diff --check` passano.
- [ ] 4.2 Eseguire `npm test`, `npm run build` e `openspec validate p0-8b-hit-points --strict --no-interactive`. Verifica: tutti passano.
- [ ] 4.3 Verifica end-to-end su Master e due Adventurer:
  - un PG con 12 HP e 5 temporanei riceve `-8` dalla scheda (9/0), poi `-30` (0 HP, Privo di sensi e Prono);
  - il Master scrive `+1` (1 HP, Privo di sensi tolto, Prono conservato, contatori a 0);
  - il proprietario scrive `+50` (massimo, nessun errore);
  - l'altro Adventurer non vede barra né HP, nemmeno nella risposta di rete, mentre il Master vede la barra sotto ogni token;
  - suspend e resume conservano HP allineati alla scheda.

  Verifica: l'esito di ogni scenario è riportato nel riepilogo della change.
