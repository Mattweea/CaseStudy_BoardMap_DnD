## Context

La motivazione è in `proposal.md`. Stato attuale rilevante:

- **Nessuno stato "combattimento".**
  - `POST /api/battle-map/combat/start` scrive solo `combatAnnouncement`.
  - `moveOwnedToken` applica il budget quando `battleMapState.initiatives.length > 0`.
- **Mutazioni del tracker lato client.** Tutte le mutazioni (`setInitiative`, `setInitiatives`, `reorderInitiatives`, `clearInitiative(s)`, `cycleTurn`) sono commit dello stato completo del Master via `PUT /api/battle-map/state`, protetti da `baseVersion`.
- **Tiro nel browser del Master.** `InitiativeRollModal` tira in locale (`rollDice`/`rollSingleDie`), senza passare dal server né dal log.
- **Riordino limitato.** Il drag in `InitiativePanel` è permesso solo fra voci con lo stesso valore.
- **Bersaglio `initiative` della scheda.** Passa da `rollCharacterSheetTarget` come bersaglio `dual` (`unresolved`), produce una voce di log e non tocca il tracker.
- **Collegamento scheda → token.** `projectToken(ownerUserId, …)` usa il token `player` il cui `ownerUserId` coincide con il proprietario della scheda.
- **Avvisi di turno.** `getTurnNotice(user)` calcola già per utente l'avviso `next`/`turn` con `turnTransitionId`. `App.tsx` mostra la modale ma non riproduce suoni.
- **Motore dei dadi.** `shared/dice-engine.mjs` supporta ancora `advantage`/`disadvantage` con dadi `kept`/`discarded`, senza chiamanti autorevoli.
- **Scheda.** È un documento JSON versionato in SQLite, con validazione a chiavi ammesse in `server/character-sheet-schema.mjs`.
- **Roster.** È duplicato in `src/constants/characters.ts` e `server/characters.mjs`. Il campo `initiativeMode` è `advantage` solo per Ragnar.

## Goals / Non-Goals

**Goals:**

- Un'unica fonte autorevole, sul server, per modalità di sessione, fase dell'incontro, tiro d'iniziativa, ordinamento e avanzamento.
- Una sola operazione atomica, con un solo incremento di versione, per "tiro + voce nel tracker + log".
- Nessuna frazione di spareggio verso gli Adventurer.
- Compatibilità con gli snapshot e le schede esistenti, senza migrazioni SQLite.

**Non-Goals:**

- HP e danni (`p0-8b`), condizioni e velocità (`p0-8c`).
- Voci d'iniziativa per i PNG del Master basate su una scheda (P0.9).
- Iniziativa di gruppo.
- Sorpresa.
- Reazioni.

## Decisions

### 1. Forma dello stato condiviso

Nuovi campi in `BattleMapSharedState` e nel suo equivalente server:

- `sessionMode: 'exploration' | 'combat'`, predefinito `'exploration'`.
- `isRoundStarted: boolean`, significativo solo in combattimento: `false` durante la fase di tiro.
- `playersCanEndTurn: boolean`, predefinito `false`.
- `InitiativeEntry` si estende con:
  - `dexModifier: number`;
  - `tiebreaker?: number` (in `[0, 1)`, generato dal server);
  - `mode?: 'normal' | 'advantage' | 'disadvantage'`.

**Alternativa scartata:** ricavare la fase dal fatto che `activeTurnTokenId` sia nullo. Il Master può rimuovere la voce attiva, e allora il turno si annulla anche a round avviato. Un flag esplicito evita l'ambiguità.

**Normalizzazione, con invarianti imposte da entrambi i lati:**

- In `exploration`: `initiatives = []`, `activeTurnTokenId = null`, `isRoundStarted = false`.
- In fase di tiro: `activeTurnTokenId = null`.
- Snapshot senza `sessionMode`:
  - voci presenti → `combat`, con `isRoundStarted = activeTurnTokenId !== null`;
  - nessuna voce → `exploration`.

  Così un incontro in corso non si perde alla ripresa.
- Entry senza `dexModifier`: si ricava dal token (vedi decisione 4).
- Entry senza `tiebreaker`:
  - **solo il server** la genera con `crypto`;
  - la normalizzazione client la lascia assente, perché introdurre casualità nel client produrrebbe ordini divergenti.

**Sanitizzazione:** `sanitizeStateForUser` rimuove `tiebreaker` dalle voci per gli Adventurer. Il Master riceve lo stato completo, perché i suoi commit a stato pieno devono poterlo rimandare intatto.

### 2. Operazioni con regole su endpoint dedicati, modifiche manuali sul commit del Master

Endpoint dedicati, per operazioni che hanno regole o autorizzazioni per ruolo:

| Endpoint | Ruolo | Effetto |
|---|---|---|
| `POST /api/battle-map/combat/start` (esteso) | Master | entra in combattimento, azzera il tracker, apre la fase di tiro, crea l'annuncio |
| `POST /api/battle-map/combat/end` | Master | torna in esplorazione con gli azzeramenti |
| `POST /api/battle-map/combat/round/start` | Master | rifiuta con ordine vuoto; imposta `isRoundStarted` e il turno sulla prima voce |
| `POST /api/battle-map/turn/advance` `{ direction }` | Master; Adventurer solo `next` con `playersCanEndTurn` e token attivo proprio | riusa `applyRoundWrapState` |
| `POST /api/battle-map/initiative/roll` `{ tokenId, mode? }` | Adventurer (proprio personaggio, senza voce) o Master | `mode` letto solo se il chiamante è Master e il token non ha scheda |
| `POST /api/battle-map/initiative/roll-all` | Master | una sola commit per tutte le creature prive di voce |
| `POST /api/battle-map/settings/players-can-end-turn` `{ enabled }` | Master | aggiorna l'impostazione condivisa |

Riordino, valore manuale, rimozione e scelta esplicita del turno attivo restano commit a stato pieno del Master, come oggi, protetti da `baseVersion`. La normalizzazione server garantisce le invarianti della decisione 1 e genera le frazioni mancanti.

**Alternativa scartata:** spostare tutto su endpoint. Il Master ha già piena autorità sullo stato e quei comandi non hanno regole oltre la forma dei dati: servirebbero quattro endpoint in più senza guadagno di sicurezza. `cycleTurn` invece passa all'endpoint, perché l'Adventurer ne condivide una parte e perché fuori dal round la richiesta va rifiutata, non ignorata.

### 3. Tiro d'iniziativa in un modulo server unico

Un nuovo modulo `server/initiative-roll.mjs` espone una funzione pura che riceve utente, stato, servizio schede, token e `nextUint32`, e restituisce `{ error }` oppure `{ entry, log }`. Comportamento:

1. **Autorizzazione e prerequisiti:**
   - la sessione deve essere in combattimento;
   - il token deve essere una creatura non esclusa;
   - un Adventurer può tirare solo per il proprio token `player` non famiglio, e solo se non ha già una voce.
2. **Token collegato a una scheda** (proprietario = `ownerUserId`):
   - il modificatore arriva da `computeInitiative`;
   - `dexModifier` dal punteggio di Destrezza;
   - la modalità da `character.initiativeRollMode`.
3. **Token senza scheda:**
   - il modificatore arriva da `token.initiativeModifier`, che vale anche come `dexModifier`;
   - la modalità è quella richiesta dal Master, altrimenti `normal`.
4. **Risoluzione** con `resolveDiceRoll({ groups: [{ count: 1, sides: 20, modifier }], mode })`. Vantaggio e svantaggio producono dadi `kept`/`discarded`.
5. **Log:**
   - etichetta «Iniziativa», nome del personaggio, `source` della scheda quando esiste;
   - `visibility` `public` per il personaggio di un Adventurer, `secret` per ogni altra creatura.

Sia l'endpoint `initiative/roll` sia il bersaglio `initiative` di `POST /api/battle-map/rolls` chiamano questo modulo. Per la scheda si ricava prima il token collegato; senza token il tiro è rifiutato. In `rollCharacterSheetTarget` il bersaglio `initiative` non passa più per il ramo `dual`.

La commit inserisce la voce con la regola della decisione 5, aggiunge il log (tetto di 30), incrementa la versione una volta e trasmette. Il gestore è sincrono dal controllo alla commit: nel processo Node due richieste concorrenti vengono serializzate, e la seconda trova la voce già presente. Il client disabilita il comando mentre la richiesta è in corso.

**Alternativa scartata:** un bersaglio `initiative` indipendente dal tracker. Produrrebbe due fonti per lo stesso valore.

### 4. Modificatore di Destrezza per lo spareggio

`dexModifier` viene registrato sulla voce al momento della creazione e non viene ricalcolato: l'ordine non deve cambiare se la Destrezza cambia a metà combattimento. Per le voci create dal commit manuale del Master, la normalizzazione server lo ricava come nel tiro, dalla scheda collegata oppure da `initiativeModifier`.

### 5. Regola d'inserimento senza riordino globale

`compareInitiative(a, b)`, in un modulo `shared/` usato da server e test, confronta nell'ordine:

1. `value` decrescente;
2. `dexModifier` decrescente;
3. `tiebreaker` decrescente.

Una voce nuova si inserisce davanti alla prima voce esistente `e` tale che `compareInitiative(nuova, e) < 0`; se non ce n'è nessuna, va in coda. L'array già presente non viene mai riordinato: così gli spostamenti del Master sopravvivono.

Sostituire la voce di un token equivale a rimuoverla e reinserirla. «Tira per tutti» inserisce le voci una alla volta nell'ordine dei token.

**Alternativa scartata:** un flag `pinned` per le voci spostate più un riordino globale. È più complesso da spiegare e cambia la posizione delle voci non toccate.

### 6. Modalità d'iniziativa nella scheda

- **Schema:** nuovo campo `character.initiativeRollMode`, con regola di patch enum `normal | advantage | disadvantage`.
- **Scheda nuova:** `createInitialCharacterSheetData` lo inizializza a `normal`.
- **Scheda esistente senza il campo:** la normalizzazione in lettura lo completa a `normal`, senza incrementare la versione. La prima scrittura lo persiste.
- **Il roster non decide la modalità:** `initiativeMode` dei profili (oggi `advantage` per Ragnar) non viene letto. Chi gioca sceglie la modalità dalla scheda.
- **Nessuna migrazione SQL.**
- **Client:**
  - `CharacterTab` mostra un pulsante con icona di impostazioni accanto al riquadro Iniziativa;
  - il pulsante apre un piccolo gruppo di tre opzioni (radio) accessibile da tastiera;
  - sul riquadro compare un'etichetta `V` o `S` quando la modalità non è Normale.

`initiativeMode` sui token e sui profili del roster resta nei dati per compatibilità ma nessun flusso lo legge più. La riga di `combat_movement_and_dice.md` su Ragnar va sostituita dalla regola della modalità scelta nella scheda.

### 7. Movimento

In `moveOwnedToken` il predicato diventa `budgetApplies = sessionMode === 'combat' && isRoundStarted`:

- in fase di tiro il movimento resta libero e non addebitato, come in esplorazione: il Master può chiedere ai giocatori di disporsi prima del round 1;
- in esplorazione il movimento non incrementa `movementUsedByTokenId` né `diagonalParityByTokenId`.

La pianificazione client usa lo stesso predicato per mostrare o nascondere il budget. Lo scatto resta legato al turno attivo, quindi è disponibile solo a round avviato.

### 8. Annuncio e audio

- **Annuncio:**
  - `combatAnnouncement` riceve un nuovo id a ogni ingresso in combattimento;
  - titolo corretto in «Il combattimento ha inizio», messaggio attuale mantenuto;
  - la card mostra un SVG composto da `crossed-swords` e `shield` di game-icons.net (CC BY 3.0), aggiunti all'elenco di attribuzione esistente.
- **Asset audio:**
  - tre file CC0 convertiti in `.ogg` sotto `public/media/audio/`, a volume normalizzato: un corno da battaglia per l'avvio («Their coming» di StumpyStrust, OpenGameArt), un suono breve di Kenney Interface Sounds per «prossimo» e tamburi da battaglia «BAM BA BAM» sintetizzati per il progetto per «tocca a te»;
  - il pacchetto Kenney RPG Audio, previsto in origine, non aveva un suono di avvio adatto: il primo clangore metallico risultava sgradevole e poco udibile.
- **Preferenze:**
  - `shared/combat-audio-preferences.mjs`, sul modello di `dice-presentation-preferences.mjs`, con `enabled` (predefinito `true`) e `volume` (predefinito `0.6`);
  - un hook `useCombatAudioPreferences`;
  - i controlli nella tab Impostazioni.
- **Riproduzione:** un helper crea un `HTMLAudioElement` per suono e chiama `play()` intercettando il rifiuto della promessa. Il suono parte quando cambia l'id dell'annuncio o di `turnNotice`, cioè negli stessi punti in cui `App.tsx` già apre le modali.
- **Avvisi di turno:** `getTurnNotice` restituisce un avviso solo con `isRoundStarted`.

### 9. Undo

| Operazione | Undo |
|---|---|
| Ingresso e uscita dal combattimento, avvio del round, avanzamento del Master | undo a snapshot del Master, come le altre azioni del Master |
| Tiri d'iniziativa | nessuno: annullarli rimuoverebbe anche la voce di log, e il Master corregge con modifica o rimozione |
| Fine turno dell'Adventurer | nessun inverso per l'Adventurer: il Master può tornare indietro |

## Risks / Trade-offs

- **Commit a stato pieno del Master contro un tiro concorrente.** Il commit del Master fallisce per `baseVersion` obsoleta e il client si riallinea: nessuna voce persa, al costo di un'azione da ripetere per il Master.
- **Log `discarded` di nuovo prodotti, contro la nota di P0.7.5 «nessun tiro nuovo lo produce».** La presentazione rende già i dadi con pari enfasi e `DiceLogEntry` legge `disposition`. Si aggiorna la documentazione del contratto dei dadi e si verifica la card con un tiro d'iniziativa con vantaggio.
- **Fonti diverse per `dexModifier`.** Per un token senza scheda `initiativeModifier` include eventuali bonus, quindi non è la Destrezza pura. È accettabile finché i PNG non hanno una scheda (P0.9); la regola è documentata.
- **Autoplay bloccato dal browser.** Il login richiede un'interazione, quindi in pratica l'audio è sbloccato. Il rifiuto di `play()` è silenzioso e la modale compare comunque.
- **Uno snapshot legacy con voci ma senza turno attivo si carica in fase di tiro.** Il Master avvia il round con un click. Non si perdono dati.
- **Ragnar perde il vantaggio automatico.** Chi gioca Ragnar deve scegliere Vantaggio dalla scheda prima del primo tiro. È una scelta voluta; il roster duplicato non viene toccato.

## Migration Plan

1. **Deploy:** nessun passo manuale. Snapshot e schede esistenti vengono completati in normalizzazione e lettura.
2. **Rollback:**
   - uno snapshot scritto dalla nuova versione contiene campi in più che la versione precedente ignora;
   - una scheda con `initiativeRollMode` viene rifiutata dalla validazione a chiavi ammesse della versione precedente. In caso di rollback va rimossa la chiave, oppure tollerata con un hotfix della validazione.
