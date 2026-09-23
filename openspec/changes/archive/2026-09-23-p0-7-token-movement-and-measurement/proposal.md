## Why

Muovere un token è, dopo il tiro di dado, il gesto più frequente del combattimento, ma oggi parte e arriva senza che nessuno veda quanto costa, e il costo che il server addebita non è quello che le regole 5e prevedono. Il server accumula separatamente lo spostamento orizzontale e quello verticale del turno e ne spende il massimo (`movementUsedFromAxisUsage` in `server/index.mjs`): un percorso a L di tre caselle a destra e tre in basso costa tre caselle invece di sei, quindi un personaggio con velocità 6 può percorrerne 12 pagandone 6. Mancano inoltre righello, percorso misurato, sagome e ping, cioè gli strumenti con cui il tavolo decide un movimento prima di compierlo.

## What Changes

- **BREAKING (regola di gioco):** il costo del movimento passa dal massimo per asse alla somma dei costi dei singoli passi lungo il percorso compiuto. Un percorso spezzato costa di più di quanto costi oggi; i percorsi in linea retta e quelli interamente diagonali restano invariati con la regola standard.
- Nuovo strumento **righello**, indipendente dal movimento, disponibile a ogni partecipante autenticato su qualunque punto della mappa, con waypoint per i percorsi spezzati e costo mostrato in caselle e nell'unità della partita.
- **Pianificazione del movimento unificata per ogni ruolo:** un token che si ha il diritto di muovere non si sposta più seguendo il puntatore, resta fermo alla posizione di partenza mentre il percorso misurato lo precede, con costo per segmento, totale e budget residuo. Il click ha un solo significato, aggiungere un punto al percorso: quello sul token apre la pianificazione, quelli successivi spezzano il percorso. La destinazione non si clicca, è la casella sotto il puntatore quando si preme `Spazio`, unico gesto di conferma; `Backspace` toglie l'ultimo waypoint e `Esc` annulla senza inviare nulla. Master e Player usano lo stesso gesto e vedono la stessa misura.
- Il **motivo di un movimento rifiutato** dal server — budget insufficiente, ostacolo, destinazione occupata — è mostrato al richiedente invece di essere scartato.
- Nuove impostazioni di partita, modificabili dal solo Master: **regola delle diagonali** (standard PHB o variante DMG 5-10-5) e **unità di misura** (etichetta più valore di una casella).
- L'endpoint di movimento accetta i **waypoint** del percorso e il server ne ricalcola costo, ostacoli per segmento, sovrapposizioni e budget; la posizione finale da sola non è più un payload sufficiente per un percorso non banale.
- Nuove **sagome effimere condivise** — cerchio, cono e linea — visibili agli altri partecipanti mentre vengono disegnate e non persistite, con il centro dell'area sempre evidenziato.
- Nuovo **ping effimero** visibile a tutti, senza alcun controllo sulla visuale altrui.
- Nuovo evento effimero **`token-walk`**: dopo che un movimento è stato accettato, il server trasmette il percorso a chi già vede il token, così ogni client anima la stessa camminata invece di vedere il pezzo saltare alla destinazione. Puramente presentazionale, filtrato per visibilità come le sagome.
- Nuovo modulo condiviso client/server per il costo di percorso, sul modello di `shared/dnd-rules.mjs`, così che la misura mostrata e quella addebitata non possano divergere.

Fuori ambito: pathfinding automatico attorno agli ostacoli, terreno difficile, movimento verticale, sagome persistenti come entità di scena (P0.9), persistenza delle impostazioni fra riavvii (P0.11), collegamento con iniziativa e turni oltre alla lettura del budget già in uso (P0.8).

## Capabilities

### New Capabilities

- `token-movement-and-measurement`: costo di percorso e regola delle diagonali, righello e percorso misurato prima della conferma, validazione server del percorso completo, unità di misura della partita, sagome effimere condivise e ping.

### Modified Capabilities

- `session-workspace`: la mappa acquisisce tre interazioni oltre a zoom, spostamento della visuale e trascinamento dei token — righello, sagome e ping — che devono restare disponibili con il pannello destro aperto o richiuso e raggiungibili da tastiera come gli altri controlli di mappa.

## Impact

- **Server** (`server/index.mjs`): `moveOwnedToken`, `calculateMovementAxisUsage`, `movementUsedFromAxisUsage`, `findBlockedMovement`, `gridDistance`, la rotta `POST /api/battle-map/move`, l'annullamento per utente dei movimenti, `normalizeSharedState` e `validateSharedState` per i nuovi campi di partita e il nuovo contatore di turno. Due nuove rotte per ping e sagome effimere, distribuite come eventi SSE nominati sul modello di `character-sheet-events.mjs`.
- **Shared**: nuovo `shared/grid-movement.mjs` più `shared/grid-movement.d.ts`, importato sia da Node sia da Vite come `shared/dnd-rules.mjs`.
- **Client**: `src/components/Board.tsx` (la modalità `drag` è sostituita da `plan`, accanto a `pan`, `pending-token`, `select-box`, `obstacle-paint`, più la nuova `template-draw`; riga dei suggerimenti come live region degli avvisi), `src/hooks/useBattleMapState.ts` (payload del movimento, eventi SSE effimeri, motivo del rifiuto), `src/types/index.ts` (stato condiviso, `MovementNotice`), `src/App.tsx` (controlli di mappa e impostazioni Master), `src/utils/board.ts`.
- **Compatibilità**: gli snapshot salvati senza i nuovi campi devono caricarsi con i valori predefiniti (standard PHB, unità in metri a `1,5` per casella) e il contatore per asse esistente deve essere convertito o azzerato senza rompere il turno in corso.
- **Documentazione**: `Docs/ai/gameplay/combat_movement_and_dice.md` (regola del costo), `Docs/ai/frontend/board_interaction_and_visibility.md` (nuove interazioni), `Docs/ai/backend/shared_state_and_persistence.md` (nuovi campi condivisi ed eventi effimeri); verifica con `npm run docs:check`.
