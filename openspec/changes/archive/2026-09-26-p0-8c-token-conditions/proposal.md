## Why

Le condizioni dei token oggi non sono quelle del PHB 5e 2014 (Morto, Condizionato, Ispirato) e non hanno alcun effetto sul gioco. Il server accetta qualunque stringa e sostituisce l'intero elenco a ogni modifica, quindi due modifiche contemporanee possono cancellarsi a vicenda. P0.8 (sezione in `FEATURES_VTT.md`) chiede condizioni ufficiali, applicabili in fretta dal token e con effetto sulla velocità. Questa change precede `p0-8b` perché gli HP a 0 devono poter applicare Privo di sensi.

## What Changes

- **Catalogo delle creature:** le quattordici condizioni del PHB 2014 (Accecato, Affascinato, Assordato, Spaventato, Afferrato, Incapacitato, Invisibile, Paralizzato, Pietrificato, Avvelenato, Prono, Trattenuto, Stordito, Privo di sensi) più Indebolimento con livelli da 1 a 6. Morto, Condizionato e Ispirato escono dal catalogo e vengono tolti dagli snapshot esistenti. **BREAKING** per gli snapshot che le contengono.
- **Veicoli:** Rotto e Ribaltato restano come catalogo separato.
- **Menu radiale sul token:**
  - si apre con click destro, oppure con `S` e `Shift+F10` sul token con il fuoco, quando nessuna interazione di mappa è in corso;
  - mostra quattro condizioni frequenti (Prono, Afferrato, Trattenuto, Avvelenato) e un comando `+` che apre le altre in un pannello a griglia; quando il token è prono, l'azione «Alzati» (con costo) si affianca all'interruttore Prono, che resta disattivabile senza costo, per esempio quando un alleato aiuta a rialzarsi;
  - ogni condizione ha un tasto d'accesso di una lettera e `0`-`6` impostano l'Indebolimento, senza che i tasti premuti nel menu muovano o cancellino il token;
  - resta dentro l'area visibile della mappa e il pannello `+` non copre il token.
- **Modale di modifica del token nascosta:** non si apre più in alcun modo, né dal click destro, né dal doppio click, né dal tracker, né dall'elenco degli elementi. Il componente resta nel codice. Le modifiche ai personaggi passano dalla scheda. **BREAKING** per il Master, che fino a P0.9 non ha più una superficie per modificare nome, HP, aure, nascondimento e struttura di nemici, oggetti e veicoli.
- **Operazioni singole sul server:** «aggiungi X», «togli X» e «imposta Indebolimento a N» sostituiscono l'invio dell'elenco completo. Il server valida ogni condizione contro il catalogo del tipo di token. Il giocatore agisce sui propri token, famiglio compreso; il master su tutti. **BREAKING** per il campo `conditions` dell'aggiornamento dei token propri.
- **Automatismo:** aggiungere Privo di sensi aggiunge anche Prono. Toglierlo non toglie Prono.
- **Invisibile è solo un marcatore:** il token resta visibile a tutti, reso semitrasparente. Il flag «nascosto» del master (`isInvisible`) resta separato e invariato.
- **Velocità secondo il PHB 2014**, con arrotondamento per difetto:
  - velocità 0 con Afferrato, Trattenuto, Paralizzato, Pietrificato, Stordito, Privo di sensi o Indebolimento dal livello 5, e in quel caso scatto e movimento extra non aiutano;
  - velocità base dimezzata con Indebolimento 2-4.
- **Prono:**
  - «Alzati» toglie la condizione e costa metà della velocità intera, arrotondata per difetto;
  - muoversi da prono senza alzarsi costa il doppio per ogni passo.
- **Resa sul token:** badge fino a tre icone più «+N», con il livello di Indebolimento visibile.

## Capabilities

### New Capabilities

- `token-conditions`: catalogo delle condizioni per tipo di token, compatibilità degli snapshot, menu radiale e pannello `+`, operazioni singole autorizzate e validate, Indebolimento a livelli, automatismo Privo di sensi → Prono, marcatore Invisibile, badge sul token, annullamento, accessibilità e scorciatoia nella legenda.

### Modified Capabilities

- `token-movement-and-measurement`: velocità derivata dalle condizioni, comando «Alzati» con il suo costo, costo raddoppiato strisciando, e i relativi motivi di rifiuto.
- `session-workspace`: la modale di modifica del token esce da ogni punto d'ingresso della GUI, senza rimuoverne il codice.

## Impact

- **Codice condiviso:** un nuovo modulo `shared/` con catalogo, velocità effettiva e costo di «Alzati», usato da client e server. `shared/grid-movement.mjs` riceve l'opzione per il costo raddoppiato.
- **Server (`server/index.mjs`):**
  - normalizzazione delle condizioni e del livello di Indebolimento;
  - nuovi endpoint per le operazioni sulle condizioni e per «Alzati»;
  - `updateOwnedToken` non accetta più l'elenco completo;
  - `moveOwnedToken` e lo scatto usano la velocità effettiva;
  - nuove azioni di annullamento del giocatore.
- **Client:**
  - `src/types/index.ts` e `src/utils/tokens.ts`;
  - `ConditionBadge.tsx` e `Token.tsx` (badge, semitrasparenza);
  - `Board.tsx` (menu radiale, scorciatoie, pianificazione con velocità effettiva e strisciare);
  - `ElementModals.tsx` (componente invariato; nascosto il comando «Modifica» dell'elenco elementi), `InitiativePanel.tsx` (click destro sulle voci inerte);
  - `useBattleMapState.ts` (nuove mutazioni);
  - legenda dei comandi.
- **Asset:** icone game-icons.net (CC BY 3.0), con l'attribuzione aggiornata.
- **Documentazione:** `Docs/ai/gameplay/token_and_vehicle_rules.md`, `Docs/ai/gameplay/combat_movement_and_dice.md`, `Docs/ai/backend/shared_state_and_persistence.md`, `Docs/ai/frontend/board_interaction_and_visibility.md` e la sezione P0.8 di `FEATURES_VTT.md`.
- **Fuori da questa change:**
  - HP e applicazione automatica di Privo di sensi a 0 HP (`p0-8b`);
  - durate;
  - effetti diversi dalla velocità;
  - menu su dispositivi touch.
