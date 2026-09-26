## Why

Oggi gli HP di un PG si cambiano solo scrivendo un valore assoluto nella scheda. Chi gioca fa il conto a mente, compreso l'ordine fra temporanei e attuali, e due danni quasi simultanei possono sovrascriversi. Nessuno applica Privo di sensi a 0 HP. Il token mostra `attuali/massimi` a tutti i partecipanti, e i campi HP di ogni token arrivano a ogni Player. P0.8 (sezione in `FEATURES_VTT.md`) chiede `-N` e `+N` con l'aritmetica del PHB, la transizione a e da 0 HP e HP visibili solo al Master e al proprietario. È l'ultima change di P0.8 e dipende da `p0-8c` per Privo di sensi.

## What Changes

- **`±N` dalla scheda:** il campo degli HP attuali accetta, oltre a un valore assoluto, `-N` (danno) e `+N` (cura), con N intero da 1 a 999. Il valore si invia alla conferma, non a ogni tasto. Può farlo solo chi può già modificare la scheda: il proprietario e il Master. Il token non è un punto d'ingresso.
- **Conto sul server**, sui valori correnti:
  - il danno scala prima i temporanei, poi gli attuali, fino a 0, e l'eccedenza si ignora;
  - la cura aggiunge fino al massimo senza errore e non tocca i temporanei;
  - `+N` senza massimo impostato viene rifiutato.

  Due `±N` quasi simultanei si applicano entrambi. I temporanei restano un valore assoluto scritto a mano.
- **Transizioni a e da 0 HP**, per qualunque via, compreso un valore assoluto:
  - scendere a 0 applica Privo di sensi, e quindi Prono;
  - risalire da 0 toglie Privo di sensi, lascia Prono e azzera successi e fallimenti contro morte.
- **Nessuna automazione** per tiri salvezza contro morte, danno massiccio, resistenze, vulnerabilità e immunità.
- **HP del token derivati dalla scheda:** per il token canonico di un PG, attuali, massimi e temporanei sono sempre quelli della scheda. Il server ignora i valori inviati da un client, e l'aggiornamento di un token proprio non accetta più campi HP. **BREAKING** per un client che modificava gli HP dal token.
- **Visibilità:** gli HP di un token arrivano solo al Master e al proprietario. Il server li toglie dallo snapshot di ogni altro Player. **BREAKING** per chi leggeva gli HP degli altri token.
- **Barra della vita sotto il token**, al posto del testo `attuali/massimi`:
  - HP attuali e temporanei rispetto al massimo, con tono per fasce;
  - il numero esatto al passaggio del mouse o al fuoco, e sempre nel nome accessibile;
  - il Master la vede su tutti i token, il Player solo sui propri.

## Capabilities

### New Capabilities

- `hit-points`: sintassi e regole di `±N`, conto sul server e concorrenza, transizioni a e da 0 HP, visibilità degli HP e barra della vita sul token.

### Modified Capabilities

- `character-sheet-management`: il collegamento fra scheda e token rende gli HP del token di un PG derivati dalla scheda e non modificabili dal token; il campo degli HP attuali accetta `±N`.

## Impact

- **Codice condiviso:** un nuovo modulo `shared/hit-points.mjs` con il parsing dell'input, l'aritmetica PHB e le transizioni, usato da client e server.
- **Server:**
  - `server/character-sheet-routes.mjs` e `server/character-sheet-service.mjs`: nuovo `POST /api/character-sheets/:id/hit-points`, e transizioni applicate nella stessa commit di ogni patch che cambia gli HP attuali;
  - `server/index.mjs`:
    - HP del token canonico derivati dalla scheda nel normalizzatore;
    - Privo di sensi applicato o tolto alla transizione;
    - `updateOwnedToken` senza campi HP;
    - sanitizzazione dei campi HP per destinatario.
- **Client:**
  - `CharacterTab.tsx`: campo degli HP attuali con conferma esplicita e `±N`;
  - `useCharacterSheet` (chiamata all'endpoint e riallineamento);
  - `Token.tsx` e `src/styles/index.css`: barra della vita al posto del testo;
  - il nome accessibile del token.
- **Documentazione:**
  - `Docs/ai/backend/character_sheet_service_and_realtime.md`;
  - `Docs/ai/backend/shared_state_and_persistence.md`;
  - `Docs/ai/backend/api_auth_and_realtime.md`;
  - `Docs/ai/gameplay/token_and_vehicle_rules.md`;
  - `Docs/ai/frontend/character_sheet_client_and_window.md`;
  - `Docs/ai/frontend/board_interaction_and_visibility.md`;
  - la sezione P0.8 di `FEATURES_VTT.md`.
- **Fuori da questa change:**
  - HP dei PNG senza scheda e una superficie del Master per modificarli (P0.9);
  - HP del famiglio, che resta com'è;
  - tiri salvezza contro morte automatici, danno massiccio, resistenze.
