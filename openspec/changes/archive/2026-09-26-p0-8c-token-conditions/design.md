## Context

La motivazione è in `proposal.md`. Stato attuale rilevante:

- **Tipo delle condizioni.** `TokenCondition` in `src/types/index.ts` contiene `dead | prone | conditioned | inspired | broken | overturned`. I cataloghi sono in `src/utils/tokens.ts` (`CREATURE_CONDITIONS`, `VEHICLE_CONDITIONS`) e le icone SVG sono scritte a mano in `ConditionBadge.tsx`.
- **Nessuna validazione sul server.**
  - La normalizzazione accetta qualunque array (`Array.isArray(token.conditions) ? token.conditions : []`).
  - `updateOwnedToken`, dietro `POST /api/battle-map/token-update`, sostituisce l'intero elenco con qualunque stringa.
  - L'annullamento del giocatore registra un'azione `token-update`.
- **Interazione sui token.**
  - `Token.tsx` apre la modale di modifica con click destro e doppio click quando `canEdit`, cioè per il master o per chi possiede il token.
  - Durante una pianificazione il click destro aggiunge un waypoint; la soppressione del menu contestuale del browser è legata al contenitore della mappa.
  - Le scorciatoie `R` `P` `C` `O` `L` (`TOOL_SHORTCUTS` in `Board.tsx`) sono inerti durante la digitazione e durante un'interazione. `S` è libero.
- **Movimento.**
  - `moveOwnedToken` calcola `movementBudget = movementCells * (dash ? 2 : 1) + extra` e applica il budget solo con `budgetApplies` (Combattimento a round avviato).
  - Il budget di un veicolo guidato usa il token del conducente come fonte del movimento.
  - `pathCost` in `shared/grid-movement.mjs` è condiviso da client e server.

## Goals / Non-Goals

**Goals:**

- Un solo modulo condiviso per catalogo, velocità effettiva e costo di «Alzati».
- Modifiche delle condizioni che non si sovrascrivono e non introducono valori arbitrari.
- Nessuna regressione su pianificazione e scorciatoie esistenti. Il click destro in pianificazione passa da waypoint ad annullamento (vedi i rischi).

**Non-Goals:**

- Durate.
- Effetti delle condizioni diversi dalla velocità: svantaggi, azioni, reazioni.
- Condizioni implicite: per esempio Paralizzato non aggiunge Incapacitato.
- Menu su touch.
- HP (`p0-8b`).

## Decisions

### 1. Modello dei dati

- **`conditions`:** resta `string[]` sul token, con identificatori stabili in inglese:
  - creature: `blinded`, `charmed`, `deafened`, `frightened`, `grappled`, `incapacitated`, `invisible`, `paralyzed`, `petrified`, `poisoned`, `prone`, `restrained`, `stunned`, `unconscious`;
  - veicoli: `broken`, `overturned`.
- **`exhaustionLevel`:** nuovo campo numerico sul token, intero da 0 a 6, predefinito 0.
- **Normalizzazione** su server e client:
  - filtra le condizioni con il catalogo del tipo di token;
  - rimuove i duplicati;
  - limita `exhaustionLevel` all'intervallo 0-6;
  - per oggetti e veicoli forza `exhaustionLevel` a 0.

**Alternativa scartata:** sei condizioni `exhaustion-1` … `exhaustion-6` nell'array. Andrebbero rese mutuamente esclusive con una regola in più, mentre il livello è per natura un numero.

### 2. Modulo condiviso `shared/token-conditions.mjs`

Esporta:

| Nome | Contenuto |
|---|---|
| `CREATURE_CONDITIONS`, `VEHICLE_CONDITIONS`, `conditionCatalogFor(type)` | i cataloghi per tipo di token |
| `SPEED_ZERO_CONDITIONS` | le condizioni che portano la velocità a 0 |
| `effectiveSpeed(movementCells, conditions, exhaustionLevel)` | `{ cells, reason }`: `reason` nomina la condizione che la riduce |
| `standUpCost(effectiveCells)` | `Math.floor(effectiveCells / 2)` |
| `movementBudget({ effectiveCells, dashed, extra })` | 0 se la velocità è 0, altrimenti `effectiveCells * (dashed ? 2 : 1) + extra` |

`src/utils/tokens.ts` riesporta i cataloghi con le etichette italiane, così il duplicato client sparisce.

### 3. Operazioni sulle condizioni

Nuovo endpoint `POST /api/battle-map/token-conditions` con corpo `{ tokenId, op }`, dove `op` è uno di:
- `{ type: 'add', condition }`
- `{ type: 'remove', condition }`
- `{ type: 'set-exhaustion', level }`

**Autorizzazione:** Master su tutto; Adventurer se `token.ownerUserId === user.id`, famigli compresi.

**Validazione:** condizione nel catalogo del tipo, livello da 0 a 6, token esistente.

**Applicazione:** sulle condizioni correnti. `add unconscious` aggiunge anche `prone`. Una no-op restituisce lo snapshot senza incrementare la versione.

**Annullamento:**
- Adventurer: azione inversa `token-conditions` con `{ tokenId, added: [...], removed: [...], previousExhaustion }`, cioè solo ciò che è cambiato. L'annullamento toglie ciò che è stato aggiunto, se c'è ancora, e rimette ciò che è stato tolto, se manca ancora.
- Master: annullamento a snapshot.

**Commit a stato pieno del Master:** resta disponibile per gli altri flussi del Master, e la normalizzazione lo filtra.

**`updateOwnedToken`:** ignora `conditions`, che resta nel payload solo per compatibilità dei client vecchi. Le condizioni passano solo dall'endpoint dedicato.

**Alternativa scartata:** controllo di versione ottimistico sull'intero elenco. Farebbe fallire una delle due richieste contemporanee invece di comporle.

### 4. «Alzati»

Nuovo endpoint `POST /api/battle-map/stand-up` con corpo `{ tokenId }`, con le stesse autorizzazioni del punto 3.

Per l'Adventurer:
- la sessione non deve essere in fase di tiro;
- la velocità effettiva deve essere maggiore di 0;
- con `budgetApplies`, il costo `standUpCost` deve stare nel residuo `movementBudget - usedCells`, e viene addebitato su `movementUsedByTokenId`.

In Esplorazione o per il Master, l'endpoint toglie `prone` senza costo.

L'inverso dell'Adventurer è `stand-up`, con `{ tokenId, chargedCells }`.

**Alternativa scartata:** alzarsi in automatico alla prima mossa. L'utente ha scelto un comando esplicito, perché strisciare è una scelta legittima.

### 5. Movimento

In `moveOwnedToken` e nella pianificazione client:

- **Velocità effettiva:** si calcola dal token mosso quando è una creatura. Per un veicolo guidato si usa `movementCells` del conducente senza condizioni, come oggi.
- **Velocità 0:** rifiuto per l'Adventurer in ogni modalità, prima del controllo del budget.
- **Strisciare:** se il token mosso è una creatura con `prone` e chi muove è l'Adventurer, `pathCost` riceve un nuovo parametro `stepCostMultiplier: 2`. Ogni passo raddoppia e l'alternanza diagonale procede invariata.
- **Scatto:** l'endpoint resta invariato; il suo effetto passa da `movementBudget`, che restituisce 0 con velocità 0.

Il parametro di `pathCost` è opzionale e vale 1 di default, così nessun chiamante esistente cambia risultato.

### 6. Menu radiale

- **Componente.** Nuovo componente `TokenRadialMenu`, montato in `Board.tsx` in un livello sopra i token, posizionato sul centro del token secondo lo zoom.
- **Apertura:**
  - `Token.tsx` inoltra il click destro a `onOpenMenu` quando `canEdit` e non c'è `interaction`;
  - `S` e `Shift+F10` si aggiungono al gestore delle scorciatoie, con le stesse guardie, e agiscono su `document.activeElement` se è un token.
- **Struttura:**
  - `role="menu"` con voci `menuitemcheckbox` (`aria-checked`) per le condizioni e `menuitem` per `+`, «Alzati» e «Scatto»;
  - corona con le condizioni frequenti; con due sole voci (veicolo) stanno a sinistra e a destra del token invece che sopra e sotto;
  - Prono resta un interruttore anche sul token prono: disattivarlo usa l'operazione `remove` di `token-conditions`, senza costo, per quando un alleato aiuta a rialzarsi o il Master lo decide. «Alzati» (`menuitem`, solo sul token prono) chiama `onStandUp`, cioè l'endpoint `stand-up` con costo e rifiuti. Le due vie restano distinte perché una è uno stato e l'altra un'azione che consuma movimento;
  - sotto la corona una riga con `+` e le azioni «Alzati» e «Scatto», queste ultime con lo stile pieno d'accento, così non si confondono con gli interruttori della corona. Quando «Alzati» sparisce perché Prono è stato tolto e aveva il fuoco, il fuoco passa a Prono sulla corona; la navigazione con le frecce legge dal DOM la voce a fuoco, perché le voci della riga cambiano posizione;
  - stato attivo: spunta sul bordo della voce oltre al colore, perché l'arancio d'accento coincide con il colore di Afferrato;
  - tra la corona e la riga delle azioni un'etichetta di testo (`aria-hidden`, il nome accessibile resta sulla voce) con nome, stato e tasto della voce sotto il puntatore o, dopo una navigazione da tastiera (frecce, `Home`/`End`, `Tab`), di quella a fuoco. Il fuoco iniziale sulla prima voce non è una scelta dell'utente, quindi all'apertura l'etichetta è vuota; resta montata con `visibility: hidden` perché la sua comparsa non cambi l'ingombro misurato. Sta sotto la corona e non al centro per non coprire il token;
  - una regione `role="status"` annuncia l'esito dei tasti d'accesso, perché la voce attivata da tastiera spesso non ha il fuoco.
- **Tastiera:**
  - frecce per navigare, anche sul selettore di Indebolimento del pannello;
  - `Esc` chiude, o dal pannello torna alla corona, e alla chiusura ridà il fuoco al token;
  - tasti d'accesso fissi, sottolineati nelle etichette del pannello e mostrati nell'etichetta centrale: P Prono, A Afferrato, T Trattenuto, V Avvelenato, C Accecato, F Affascinato, D Assordato, S Spaventato, I Incapacitato, B Invisibile, R Paralizzato, E Pietrificato, O Stordito, N Privo di sensi; per i veicoli R Rotto, B Ribaltato. Valgono sia dalla corona sia dal pannello. «Alzati» ha la L, libera tra le lettere delle condizioni; P resta l'interruttore di Prono anche sul token prono;
  - `0`-`6` impostano l'Indebolimento di una creatura;
  - il gestore del menu ferma la propagazione di ogni tasto senza `Ctrl`/`Meta`/`Alt` e diverso da `Tab`: i gestori globali di `App.tsx` (frecce/WASD, `Canc`) e di `Board.tsx` (strumenti R/P/C/O/L) ascoltano su `window` e altrimenti agirebbero sul token selezionato. `Ctrl+Z` continua a raggiungere l'annullamento.
- **Posizionamento:** il menu si ancora al centro del token; se la corona con la riga sotto non entra nello stage visibile, l'ancora si sposta del minimo necessario per restarci dentro. Il pannello `+` si apre accanto al token, dal lato orizzontale con più spazio, ed è limitato verticalmente allo stage, così non copre il token.
- **Pannello `+`:** un popover a griglia con lo stesso schema, che contiene le dieci condizioni restanti e un selettore del livello di Indebolimento da 0 a 6 con `−`/`+` e il livello corrente.
- **Invio delle operazioni.** Ogni voce chiama la mutazione del hook, con aggiornamento ottimistico e riallineamento dallo snapshot in caso di rifiuto. Il motivo del rifiuto usa il toast già in uso per i movimenti (`MovementNotice`).
- **Modale di modifica:** nascosta, vedi la decisione 8.

### 7. Resa

- **Icone:** `ConditionBadge` passa a icone game-icons.net (CC BY 3.0), inlineate come in `DiceIcons.tsx`.
- **Badge sul token:** al massimo tre, poi «+N». L'elenco completo va nel nome accessibile del token (`aria-label`) e nel `title` dell'indicatore.
- **Indebolimento:** il badge mostra il numero del livello.
- **Invisibile:** `invisible` aggiunge una classe che riduce l'opacità del token; `isInvisible` e la sanitizzazione non cambiano.
- **Tracker:** usa già `ConditionBadge` e riceve i nuovi cataloghi senza altre modifiche.

### 8. Modale di modifica nascosta senza rimuoverla

`EditElementModal` e `openEditTokenModal` restano nel codice. Si tolgono solo i punti d'ingresso:

| Punto d'ingresso | Intervento |
|---|---|
| `Token.tsx` | il click destro va al menu radiale; il doppio click non fa nulla |
| click destro su un gruppo di token in `Board.tsx` | inerte |
| click destro sulle voci di `InitiativePanel.tsx` | inerte |
| comando «Modifica» di `ElementsListModal` | non renderizzato |

Il modo più piccolo e reversibile è una costante `TOKEN_EDIT_MODAL_ENABLED = false` in `App.tsx`: `openEditTokenModal` esce subito se è falsa, e i componenti non ricevono il callback. Si riattiva cambiando un solo valore, come prevede la convenzione di P0.3 per i controlli nascosti.

**Alternativa scartata:** eliminare il componente. L'utente vuole poterlo riesporre; P0.9 ne avrà bisogno per i nemici del Master.

## Risks / Trade-offs

- **Il Master perde la modifica di nemici, oggetti e veicoli fino a P0.9:** nome, HP, aure, nascondimento, gruppi, duplicazione. Restano:
  - il menu radiale per le condizioni;
  - la cancellazione dei token selezionati con il tasto `Canc` o il pulsante esistente;
  - la creazione di nuovi elementi.

  Va tenuto presente anche per `p0-8b`: gli HP di un mostro richiederanno una via di modifica sul token, dato che i mostri non hanno scheda.

- **Morto sparisce dagli snapshot.** Un token segnato come morto perde il segnale. È accettato dall'utente; p0-8b deciderà come rappresentare la morte.
- **Client vecchi aperti durante il deploy.** Continuano a inviare `conditions` a `token-update`, che le ignora senza errore; basta ricaricare la pagina.
- **Click destro durante una pianificazione.** Annulla la pianificazione come `Esc`, ovunque cada (mappa, token, ostacoli), e sostituisce il waypoint con il tasto destro di P0.7. Il punto unico è `addPlanWaypoint` in `Board.tsx`. Il `contextmenu` di quello stesso click arriva quando l'interazione è già chiusa: un flag, azzerato al pointerdown successivo, impedisce che apra anche il menu radiale. Il menu si apre con un secondo click destro. La guida dei gesti dice «Esc o tasto destro annulla».
- **Un Adventurer che striscia in Esplorazione** non paga nulla. È coerente con l'assenza di budget.
- **Il conducente paralizzato continua a guidare il veicolo.** È un limite accettato: le condizioni gestiscono solo la velocità della creatura, non la sua capacità di agire.

## Migration Plan

1. **Deploy:** normalizzazione degli snapshot all'avvio del server e alla ripresa di una sessione salvata. Nessuna migrazione SQLite: le condizioni non sono nella scheda.
2. **Rollback:** la versione precedente accetta i nuovi identificatori come stringhe libere, ma non ha etichette né icone per mostrarli. I dati non si perdono.
