## 1. Modulo condiviso e scheda

- [x] 1.1 Creare `shared/token-auras.mjs` (con `.d.ts`/`.d.mts` come gli altri moduli condivisi) con `AURA_COLORS`, `AURA_LIMITS`, `radiusCellsFromUnit`, `projectSheetAuras`, `auraRect`, `isTokenInAura` e `auraPresenceFor` (design, decisione 2). Verifica: nuovo `test/token-auras.test.mjs` copre:
  - area 5×5 per un token Medio con raggio 2 e 4×4 per un token 2×2 con raggio 1;
  - la casella in diagonale a due passi dentro l'area con raggio 2;
  - un token 2×2 con un solo angolo dentro l'area;
  - la conversione 3 m → 2 caselle e 4 m → 3 caselle con caselle da 1,5 m, con minimo 1 e massimo 24;
  - `projectSheetAuras` senza `description`;
  - `auraPresenceFor` che esclude l'aura propria (anche per il famiglio dello stesso proprietario), le aure spente, l'owner dentro un veicolo e il Master, nomina il famiglio e restituisce due righe per due aure.
- [x] 1.2 Aggiungere la collezione `auras` a `server/character-sheet-schema.mjs`: campi, dominio chiuso del colore, default, limiti di lunghezza, raggio 1-24, massimo 10 righe, collezione vuota per i documenti che non la hanno. Verifica: casi in `test/character-sheet-schema.test.mjs` per un documento senza aure (caricato con elenco vuoto), colore fuori palette, raggio 0 e 25, nome di 61 caratteri, effetto di 501 e undicesima riga (tutti rifiutati senza applicare la patch), e una riga valida accettata.
- [x] 1.3 Far riconoscere a `#projectOperations` le operazioni `set`, `add` e `remove` su `character.auras` e chiedere la proiezione del token (design, decisione 3). Verifica: casi in `test/character-sheet-service.test.mjs` in cui l'aggiunta, la modifica e la rimozione di un'aura chiamano la proiezione, mentre una patch su un campo non proiettato non la chiama.

## 2. Server

- [x] 2.1 Derivare `token.auras` nel normalizzatore del server tramite il risolutore iniettato (design, decisione 3), ignorando sempre il valore in ingresso, e togliere `auras` dai campi inoltrati da `updateOwnedToken`. Verifica: nuovo `test/token-auras-routes.test.mjs` copre:
  - commit a stato pieno del Master con un'aura su un nemico e un'aura falsa su un personaggio (nemico senza aure, personaggio con quelle della scheda);
  - `token-update` di un Adventurer con `auras` (ignorate);
  - snapshot ripreso con aure legacy su nemico e personaggio;
  - annullamento del Master dopo un'accensione (l'aura resta accesa);
  - lo stato ricevuto da un altro Adventurer senza `description`;
  - un famiglio senza aure.
- [x] 2.2 Implementare `POST /api/battle-map/token-auras` (design, decisione 4). Verifica: casi in `test/token-auras-routes.test.mjs` per:
  - accensione del proprietario in Esplorazione (scheda e token aggiornati, versione incrementata, broadcast);
  - Master sull'aura di un personaggio;
  - Adventurer sull'aura di un altro (`403`);
  - famiglio e nemico (`400`);
  - aura inesistente (`404`);
  - `active` non booleano (`400`);
  - no-op senza incremento di versione;
  - proprietario Privo di sensi con l'aura che resta accesa;
  - nessuna voce nello stack di annullamento.
- [x] 2.3 Verificare la sanitizzazione per un proprietario nascosto (design, decisione 5). Verifica: caso in `test/token-auras-routes.test.mjs` in cui il Master nasconde un personaggio con un'aura accesa e lo snapshot di un altro Adventurer non contiene né il token né le sue aure, mentre quello del Master le contiene.

## 3. Client

- [x] 3.1 Aggiornare `TokenAura` in `src/types/index.ts` e il normalizzatore client alla nuova forma, e togliere la sezione «Aura» e l'invio di `auras` da `EditElementModal`. Verifica: `npm run build` passa; caso in `test/token-auras.test.mjs` per il normalizzatore client che scarta una voce nel vecchio formato.
- [x] 3.2 Aggiungere a `useBattleMapState` la mutazione `setTokenAuraActive` con aggiornamento ottimistico, riallineamento sul rifiuto e motivo nel toast esistente. Verifica: `npm run build`; manuale con il Master che rimuove un'aura dalla scheda mentre un Adventurer ne attiva l'interruttore (rifiuto, menu riallineato, motivo mostrato), scenario «Aura rimossa nel frattempo».
- [x] 3.3 Sostituire i cerchi con i rettangoli `auraRect` in `Board.tsx` (design, decisione 6). Verifica: `npm run build`; manuale su due client:
  - scenari «Aura attorno a un token medio», «Aura attorno a un token grande» e «Variante 5-10-5 attiva»;
  - due aure sovrapposte distinguibili dai bordi;
  - aura spenta non disegnata;
  - aura di un token in un veicolo non disegnata.
- [x] 3.4 Aggiungere la voce «Aure» con tasto `U` e il suo pannello a `TokenRadialMenu` (design, decisione 8), e aggiornare la legenda. Verifica: `npm run build`; manuale come Master e come Adventurer, con mouse e sola tastiera, contro gli scenari «Pannello delle aure», «Personaggio senza aure» e «Aura da tastiera»; pannello dentro lo stage per un token nell'angolo; legenda con `U`.
- [x] 3.5 Creare `AuraPresenceBanner` e montarlo da `App.tsx` nell'host attivo della mappa (design, decisione 7). Verifica: `npm run build`; manuale su Master e due Adventurer contro tutti gli scenari di «Avviso di presenza in un'aura»:
  - ingresso, espansione da tastiera, uscita, aura spenta, due aure, famiglio, aura propria e Master;
  - schermo intero;
  - annuncio letto dallo screen reader all'ingresso senza spostamento del fuoco.
- [x] 3.7 Fondere in modalità moltiplicativa i riempimenti delle aure sovrapposte, lasciando i bordi nel colore originale (scenario «Aure sovrapposte»). Verifica: `npm run build`; controllo visivo in Chrome degli stessi SVG e CSS su uno sfondo scuro con due aure di colori diversi, zona comune distinta, bordi leggibili e mappa non oscurata dal metodo di fusione.
- [x] 3.8 Tenere visibile «Scatto» sul proprio token anche quando ha un'aura, disabilitandolo con il motivo quando non è utilizzabile (scenario «Scatto accanto alle aure»). Verifica: `npm run build`; anteprima del componente in Chrome con aura e turno attivo/fuori turno: entrambe le azioni compaiono, Scatto è abilitato nel turno e disabilitato con il motivo fuori turno; il gestore del click invia la mutazione solo quando `canDash` è vero e lo scatto non è già usato.
- [x] 3.9 Sopprimere il menu contestuale nativo dello stesso click destro che annulla una pianificazione, oltre al menu radiale (scenario «Click destro durante la pianificazione»). Verifica: `npm run build`; in Chrome, eventi pointer e contextmenu su casella e token durante il piano annullano senza menu, mentre il click destro successivo sul token apre il menu radiale.
- [x] 3.6 Aggiungere la sezione «Aure» a `CharacterTab.tsx` con righe compatte, interruttore ed editor dedicato in `RowEditor.tsx`, e passare `measurementUnit` a `CharacterSheetWindow` (design, decisione 9). Verifica: `npm run build`; manuale contro gli scenari «Creazione di un'aura», «Raggio non multiplo della casella», «Limite di aure» e «Scheda di un altro personaggio», con annullamento dell'editor che non invia nulla e interruttore della scheda allineato al menu radiale su un secondo client. Esito confermato dall'utente il 2026-09-26.

## 4. Documentazione e verifica finale

- [x] 4.1 Aggiornare:
  - `Docs/ai/gameplay/token_and_vehicle_rules.md`: aure proiettate dalla scheda, forma nuova, regola della griglia del PHB, niente aure per famigli e PNG;
  - `Docs/ai/backend/shared_state_and_persistence.md`: normalizzazione derivata dalla scheda, forme legacy scartate, sanitizzazione, interruttore non annullabile;
  - `Docs/ai/backend/character_sheet_service_and_realtime.md`: collezione `auras`, proiezione su `add`/`remove`/`set`, patch dell'interruttore;
  - `Docs/ai/backend/api_auth_and_realtime.md`: nuovo endpoint nella classe owner-scoped;
  - `Docs/ai/frontend/board_interaction_and_visibility.md`: rettangoli delle aure, voce «Aure» e tasto `U`, avviso di presenza;
  - `Docs/ai/frontend/character_sheet_client_and_window.md`: sezione, editor e unità di misura;
  - la sezione P0.8 di `FEATURES_VTT.md` (voci e stato attuale).

  Verifica: `npm run docs:check` e `git diff --check` passano.
- [x] 4.2 Eseguire `npm test`, `npm run build` e `openspec validate p0-8d-token-auras --strict --no-interactive`. Verifica: tutti passano.
- [x] 4.3 Verifica end-to-end su Master e due Adventurer:
  - un Adventurer definisce e accende un'aura e l'altro, entrando, vede l'avviso e ne legge l'effetto;
  - il Master nasconde il proprietario e l'avviso sparisce per l'altro Adventurer;
  - con la variante 5-10-5 l'area resta quadrata;
  - suspend e resume conservano aure e stato;
  - un riavvio del server conserva la definizione nella scheda.

  Verifica: l'esito di ogni scenario è riportato nel riepilogo della change, insieme alla nota sul rollback (design, Migration Plan).

## Riepilogo della verifica

L'utente ha confermato il 2026-09-26 l'esito positivo delle verifiche manuali 3.6 e 4.3. La conferma è complessiva; non è stato fornito un log separato per scenario.

| Scenario 4.3 | Esito |
| --- | --- |
| Definizione e accensione dell'aura; ingresso dell'altro Adventurer e lettura dell'effetto | OK, conferma dell'utente |
| Proprietario nascosto dal Master; avviso rimosso per l'altro Adventurer | OK, conferma dell'utente |
| Area quadrata con variante 5-10-5 | OK, conferma dell'utente |
| Aure e stato conservati dopo suspend e resume | OK, conferma dell'utente |
| Definizione conservata nella scheda dopo riavvio del server | OK, conferma dell'utente |

**Rollback:** la versione precedente rifiuta i documenti scheda che contengono `character.auras` per la validazione a chiavi esatte. Prima di tornare a quella versione occorre rimuovere la collezione `auras` dai documenti salvati; il rollback non è previsto oltre lo sviluppo locale.
