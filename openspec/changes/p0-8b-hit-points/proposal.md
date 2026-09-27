## Why

Oggi gli HP di un PG si cambiano solo scrivendo un valore assoluto nella scheda. Chi gioca fa il conto a mente, compreso l'ordine fra temporanei e attuali, e due danni quasi simultanei possono sovrascriversi. Nessuno applica Privo di sensi a 0 HP. Il token mostra `attuali/massimi` a tutti i partecipanti, e i campi HP di ogni token arrivano a ogni Player. P0.8 (sezione in `FEATURES_VTT.md`) chiede `-N` e `+N` con l'aritmetica del PHB, la transizione a e da 0 HP e HP visibili solo al Master e al proprietario. È l'ultima change di P0.8 e dipende da `p0-8c` per Privo di sensi.

## What Changes

- **`±N` dalla scheda:** il campo degli HP attuali accetta, oltre a un valore assoluto, `-N` (danno) e `+N` (cura), con N intero da 1 a 999. Il valore si invia alla conferma, non a ogni tasto. Può farlo solo chi può già modificare la scheda: il proprietario e il Master.
- **`±N` dal menu radiale del token**, solo sul token canonico di un PG:
  - la corona offre un'icona compatta per gli HP, senza duplicare la barra proporzionale sotto il token;
  - l'icona si attiva col click o dalla tastiera, e i tasti `-` e `+` aprono direttamente il campo con il segno già scritto;
  - una volta attivato, un campo compatto accanto al cuore consente di scrivere il valore, con la stessa sintassi e le stesse regole della scheda; la didascalia sotto la corona resta per le etichette.

  HP temporanei e massimi restano modificabili solo nella scheda.
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
  - HP attuali e temporanei su righe distinte, ciascuna rispetto al massimo, con tono per fasce e un distacco di 4 px dal bordo; anche con gli attuali pieni i temporanei restano visibili, come nell'indicatore della scheda;
  - il numero esatto sempre visibile dentro le rispettive righe e nel nome accessibile;
  - il Master la vede su tutti i token, il Player solo sui propri.
- **Selezione del testo al focus:** tutti i campi testuali modificabili dell'app, compresi HP, ricerca, password e aree di testo, selezionano il contenuto quando ricevono il fuoco. I controlli non testuali e i campi non modificabili restano esclusi. Il prefisso `-` o `+` del campo HP nel menu continua a comporre un delta con il numero digitato subito dopo.
- **Immagine del token canonico:** il ritratto caricato nella scheda diventa l'immagine visiva del token del personaggio, anche per gli altri partecipanti, usando il riferimento già distribuito nel roster e via SSE. Gli altri token conservano la propria immagine e lo stato condiviso della mappa non incorpora il ritratto.

## Capabilities

### New Capabilities

- `hit-points`: sintassi e regole di `±N`, conto sul server e concorrenza, transizioni a e da 0 HP, visibilità degli HP e barra della vita sul token.
- `text-input-focus`: selezione completa del contenuto al focus dei campi testuali modificabili.

### Modified Capabilities

- `character-sheet-management`: il collegamento fra scheda e token rende gli HP del token di un PG derivati dalla scheda e non modificabili con una scrittura diretta del token; il campo degli HP attuali accetta `±N`; il ritratto caricato appare sul token canonico.
- `token-conditions`: il menu radiale guadagna un'icona per gli HP con il campo accanto, e la tastiera i tasti `-` e `+`.

## Impact

- **Codice condiviso:** un nuovo modulo `shared/hit-points.mjs` con il parsing dell'input, l'aritmetica PHB e le transizioni, usato da client e server.
- **Server:**
  - `server/character-sheet-routes.mjs` e `server/character-sheet-service.mjs`: nuovo `POST /api/character-sheets/:id/hit-points`, e transizioni applicate nella stessa commit di ogni patch che cambia gli HP attuali;
  - `server/index.mjs`: nuovo `POST /api/battle-map/token-hit-points`, che risolve la scheda del token e usa la stessa logica;
  - `server/index.mjs`:
    - HP del token canonico derivati dalla scheda nel normalizzatore;
    - Privo di sensi applicato o tolto alla transizione;
    - `updateOwnedToken` senza campi HP;
    - sanitizzazione dei campi HP per destinatario.
- **Client:**
  - `CharacterTab.tsx`: campo degli HP attuali con conferma esplicita e `±N`;
  - `useCharacterSheet` (chiamata all'endpoint e riallineamento);
  - `Token.tsx` e `src/styles/index.css`: barra della vita al posto del testo;
  - `App.tsx`, `Board.tsx` e `Token.tsx`: il riferimento del ritratto della scheda prevale sull'immagine del token canonico soltanto nella resa visiva;
  - `TokenRadialMenu.tsx`: icona degli HP, campo accanto al cuore, tasti `-` e `+`, legenda;
  - `main.tsx`: selezione del testo al focus per i controlli testuali modificabili, compresi quelli resi in finestre e pannelli;
  - `useBattleMapState.ts`: mutazione dal menu con riallineamento sul rifiuto;
  - il nome accessibile del token.
- **Documentazione:**
  - `Docs/ai/backend/character_sheet_service_and_realtime.md`;
  - `Docs/ai/backend/shared_state_and_persistence.md`;
  - `Docs/ai/backend/api_auth_and_realtime.md`;
  - `Docs/ai/gameplay/token_and_vehicle_rules.md`;
  - `Docs/ai/frontend/character_sheet_client_and_window.md`;
  - `Docs/ai/frontend/board_interaction_and_visibility.md`;
  - `Docs/ai/frontend/frontend_architecture.md`;
  - la sezione P0.8 di `FEATURES_VTT.md`.
- **Fuori da questa change:**
  - HP dei PNG senza scheda e una superficie del Master per modificarli (P0.9);
  - HP del famiglio, che resta com'è;
  - tiri salvezza contro morte automatici, danno massiccio, resistenze.
