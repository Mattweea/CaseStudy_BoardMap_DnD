## Context

La motivazione è in `proposal.md`. Stato attuale rilevante:

- **Campi HP della scheda.** `character.hitPoints.{maximum,current,temporary}` sono campi `'text'` in `server/character-sheet-schema.mjs`. `character.deathSaves.{successes,failures}` usano il dominio chiuso `DEATH_SAVE_COUNTS`.
- **Campo «Attuali» della scheda.** In `CharacterTab.tsx` è un `SheetField` che invia una patch `set` a ogni modifica, raggruppata dal debounce del client. Scrivere `-8` oggi salva il testo `-8`.
- **Proiezione verso il token.** Parte da `#projectOperations` in `server/character-sheet-service.mjs`, che mappa i tre percorsi HP su `hitPoints`, `maxHitPoints` e `temporaryHitPoints` del token tramite `numericValue`, solo sulle patch.
- **Nessuna derivazione nel normalizzatore.** Il normalizzatore del server non deriva gli HP. Un commit a stato pieno, un annullamento del Master o `updateOwnedToken` (`server/index.mjs`, campo `hitPoints`) possono quindi portare il token fuori allineamento dalla scheda.
- **Aure (`p0-8d`).** Hanno già introdotto la derivazione dalla scheda nel normalizzatore: `resolveTokenAuras` usa `findLinkedSheetId` + `readInternal` e ignora sempre il valore in ingresso.
- **Condizioni.** `applyTokenCondition` (`server/index.mjs`) applica un'operazione singola sulle condizioni, con l'automatismo `unconscious` → `prone`.
- **Sanitizzazione.** `sanitizeStateForUser` filtra i token nascosti e poi **rinormalizza** lo stato. Una rimozione fatta prima della normalizzazione verrebbe quindi ricalcolata dalla derivazione, come già succede per `tiebreaker`, che viene tolto dopo.
- **Barra della scheda.** `HitPointMeter` in `CharacterTab.tsx` calcola i rapporti e il tono (sopra 0,5, sopra 0,25, altrimenti pericolo). Il token mostra il testo `attuali/massimi` (`Token.tsx`).
- **Effetti collaterali dei tiri.** Il resolver dei tiri applica già i propri effetti collaterali con `service.applyPatch(user, sheetId, { baseVersion: <live>, operations })`.

## Goals / Non-Goals

**Goals:**

- Un'unica funzione per l'aritmetica PHB e per le transizioni, condivisa e coperta da test.
- Gli HP del token di un PG sempre uguali a quelli della scheda, su ogni percorso.
- Nessun HP consegnato a chi non è il Master o il proprietario.

**Non-Goals:**

- HP dei PNG senza scheda e del famiglio, che restano campi del token.
- Una superficie del Master per modificare gli HP dei nemici.
- Regole di morte e danno tipizzato.
- Annullamento dedicato di `±N`.

## Decisions

### 1. Modulo condiviso `shared/hit-points.mjs`

Esporta:

| Nome | Contenuto |
|---|---|
| `parseHitPointInput(text)` | `{ kind: 'delta', value }` per `±N` con N da 1 a 999 (spazi ammessi fra segno e numero); `{ kind: 'absolute', value }` per un intero non negativo; `{ kind: 'empty' }`; `{ kind: 'invalid' }` per il resto, compresi `-0` e `±1000` |
| `readHitPointNumber(text)` | intero o `null`, la stessa lettura di `readWholeNumber` della scheda |
| `applyHitPointDelta({ current, temporary, maximum }, delta)` | `{ current, temporary }` secondo il PHB, oppure `{ error: 'missing-current' \| 'missing-maximum' }` |
| `hitPointTransition(previousCurrent, nextCurrent)` | `'down'` (da > 0 a 0), `'up'` (da 0 a > 0) o `null`; un valore non numerico non produce transizioni |
| `hitPointTone(current, maximum)` | `'ok' \| 'warn' \| 'danger'`, con le soglie attuali di `HitPointMeter` |

`HitPointMeter` e la barra del token usano lo stesso `hitPointTone`.

**Aritmetica:**
- danno: `absorbed = min(temporary ?? 0, N)`, `temporary -= absorbed`, `current = max(0, current - (N - absorbed))`;
- cura: `current = min(maximum, current + N)`.

Temporanei non numerici valgono 0 per il danno e restano invariati.

### 2. Endpoint `POST /api/character-sheets/:id/hit-points`

- **Corpo:** `{ delta }`, un intero diverso da 0 con valore assoluto al massimo 999.
- **Implementazione:** `CharacterSheetService.adjustHitPoints(user, id, delta)`:
  1. verifica `canWrite`;
  2. legge i valori live;
  3. calcola con `applyHitPointDelta`;
  4. applica `set` su `character.hitPoints.current` e, se è cambiato, su `character.hitPoints.temporary`, con `applyPatch` alla versione live.
- **Rifiuti:** mancano gli HP attuali o i massimi → `400` con il messaggio di rifiuto; utente non autorizzato → `403`; scheda inesistente → `404`.
- **Risposta:** la scheda pubblica aggiornata. L'evento SSE `character-sheet-patch` raggiunge proprietario e Master come per ogni patch.

**Concorrenza:** il servizio è sincrono sul processo, quindi due richieste si serializzano e la seconda legge il risultato della prima. Usare la versione live come `baseVersion` evita un `409` su un'operazione che per natura si compone.

**Alternativa scartata:** il client calcola il valore assoluto e invia un `set`. Due danni quasi simultanei produrrebbero un `409` o un valore sovrascritto, e il conto starebbe sul client.

**Alternativa scartata:** una nuova operazione relativa nella grammatica delle patch. Toccherebbe validazione, conflitti e merge di ogni patch per un solo campo.

### 3. Transizioni nella stessa commit

- **Rilevamento.** In `applyPatch`, prima della commit, il servizio confronta `readHitPointNumber` degli HP attuali prima e dopo le operazioni.
- **Risalita da 0 (`'up'`).** Il servizio **aggiunge alle operazioni** due `set` a `'0'` su `character.deathSaves.successes` e `failures`, se non sono già a 0. La scheda cambia quindi in una sola versione, e l'evento SSE porta anche l'azzeramento.
- **Notifica alla mappa.** Il servizio passa la transizione al callback di proiezione: `projectToken(ownerUserId, updates, { hitPointTransition })`.
- **Condizioni.** `projectCharacterSheetToToken` in `server/index.mjs`, sul token canonico, applica `add unconscious` (che porta `prone`) o `remove unconscious` con la stessa logica di `applyTokenCondition`, estratta in una funzione senza controllo di autorizzazione. La transizione è un effetto del sistema su un'azione già autorizzata sulla scheda.

La logica vale per ogni via: `±N`, valore assoluto dal proprietario o dal Master, e patch del resolver dei tiri se in futuro ne scrivesse una.

**Alternativa scartata:** applicare le transizioni solo nell'endpoint `±N`. Un `0` scritto a mano non renderebbe il PG Privo di sensi, contro la decisione presa.

### 4. HP del token derivati dalla scheda

- **Derivazione.** Il normalizzatore del server estende il risolutore delle aure: per il token canonico di un PG, `hitPoints`, `maxHitPoints` e `temporaryHitPoints` si leggono dalla scheda collegata (`readHitPointNumber`, `null` se non numerici). Il valore in ingresso si ignora sempre.
- **Esclusioni.** Famiglio, nemici, oggetti e veicoli conservano il valore del token.
- **`updateOwnedToken`.** Smette di accettare `hitPoints`, `maxHitPoints` e `temporaryHitPoints`.
- **Mappa della proiezione.** `#projectOperations` resta per i percorsi HP, così una patch fa partire normalizzazione, versione e broadcast.

### 5. Sanitizzazione degli HP

In `sanitizeStateForUser`, **dopo** la normalizzazione (come per `tiebreaker`), per ogni token con `ownerUserId !== user.id` i tre campi diventano `null`. Il normalizzatore client tratta `null` come assenza, e la barra non compare. Il Master riceve lo stato completo.

L'evento `token-walk` e le sagome non portano HP, quindi nessun altro canale va filtrato.

**Alternativa scartata:** nascondere la barra solo nell'interfaccia. I dati resterebbero leggibili negli strumenti del browser, contro la decisione «zero visibilità».

### 6. Campo «Attuali» nella scheda

- **Componente.** Un componente dedicato sostituisce il `SheetField`. Tiene una bozza locale, non invia nulla durante la digitazione e conferma con `Invio` o all'uscita dal campo. `Esc` ripristina il valore.
- **Esito della conferma**, secondo `parseHitPointInput`:
  - `delta`: il client chiama prima il flush delle operazioni in coda di `useCharacterSheet`, poi l'endpoint; applica la scheda restituita e scarta l'evento SSE già superato;
  - `absolute` o `empty`: una patch `set` normale;
  - `invalid`: nessuna richiesta, bozza ripristinata, messaggio associato con `aria-describedby`.
- **Errori del server.** Il messaggio (per esempio «Imposta prima gli HP massimi») compare nello stesso punto.

### 7. Barra della vita sul token

`Token.tsx` sostituisce il testo `token__hp` con:
- una barra sotto il token, con segmento attuali, segmento temporanei e tono `hitPointTone`;
- a 0 HP, barra vuota con bordo tratteggiato, così resta riconoscibile senza colore.

**Numero esatto.** «9 (+5) / 20» è un'etichetta resa visibile da `:hover` e `:focus-visible` sul pulsante del token, con `aria-hidden`.

**Nome accessibile.** Il nome accessibile del token aggiunge «Punti ferita 9 su 20, 5 temporanei».

**Quando compare.** Solo con `maxHitPoints` numerico maggiore di 0, quindi mai per chi non riceve gli HP.

## Risks / Trade-offs

- **La sanitizzazione dipende dall'ordine rispetto alla normalizzazione.** Se si rimuovono gli HP prima, la derivazione li rimette. Mitigazione: rimozione dopo la normalizzazione, con un test che controlla lo snapshot di un Adventurer.
- **Transizione e annullamento del Master.** Un annullamento a snapshot della mappa può togliere Privo di sensi a un PG ancora a 0 HP. Lo accettiamo: le condizioni restano modificabili a mano, e l'automatismo scatta solo sulle transizioni.
- **Temporanei non numerici.** Un testo libero nel campo temporanei viene trattato come 0 per il danno e lasciato invariato. È documentato, così non sorprende.
- **Un valore assoluto negativo non è più possibile nel campo «Attuali»,** perché `-N` diventa danno. Uno snapshot di scheda con un valore negativo salvato resta leggibile come testo, ma non produce transizioni finché non viene riscritto.
- **Famiglio.** I suoi HP restano del token e non hanno ancora una superficie di modifica: il limite è già noto da `p0-8c` fino a P0.9.

## Migration Plan

- **Schede.** Nessuna migrazione SQLite: i campi esistono già.
- **Snapshot.** Alla prima normalizzazione gli HP dei token dei PG si riallineano alla scheda. Gli HP dei nemici restano invariati.
- **Rollback.** Tornare indietro riporta il testo `attuali/massimi` visibile a tutti e il campo `set` diretto; nessun dato va convertito.
