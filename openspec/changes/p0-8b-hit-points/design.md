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
| `hitPointTone(current, maximum)` | `'danger'` sotto 20%, `'warn'` dal 20% al 50% incluso, `'ok'` sopra 50% |

`HitPointMeter` e la barra del token usano lo stesso `hitPointTone`.
I due indicatori mappano rispettivamente `danger`, `warn` e `ok` sugli stessi colori rosso, giallo e verde; i temporanei conservano il proprio azzurro.
I due indicatori rendono gli HP attuali e temporanei su righe indipendenti, entrambe proporzionate al massimo: la riga temporanea non usa soltanto lo spazio rimasto dopo gli attuali. Con 40/40 e 6 temporanei, la riga degli attuali è piena e quella temporanea misura 6/40. Oltre il massimo visivo la lunghezza si limita al 100%, mentre il valore esatto resta nei campi e nel nome accessibile del token.

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

### 2b. Endpoint dal token: `POST /api/battle-map/token-hit-points`

Il menu radiale non conosce la scheda, quindi l'endpoint parte dal token. Il corpo è `{ tokenId, input }`, con `input` interpretato da `parseHitPointInput`.

**Controlli, in quest'ordine:**

| Caso | Esito |
|---|---|
| token inesistente | `404` |
| token che non è il canonico di un PG con scheda collegata (famiglio, nemico, oggetto, veicolo) | `400` |
| né Master né proprietario | `403` |
| input `invalid` | `400` con la sintassi ammessa |

**Applicazione:**
- `delta` usa `adjustHitPoints`;
- `absolute` ed `empty` usano `applyPatch` con un `set` alla versione live.

Tutte e due le strade passano per le transizioni del punto 3.

**Risposta:** lo snapshot sanitizzato per chi chiama. Sul rifiuto il corpo contiene il motivo e lo snapshot, come per l'interruttore delle aure.

**Alternativa scartata:** il client risolve l'id della scheda dal roster e chiama l'endpoint della scheda. Il Master dovrebbe conoscere la scheda di ogni token, e la verifica «token canonico di un PG» resterebbe solo sul client.

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
- una barra 4 px sotto il bordo del token, abbastanza alta per le cifre, con una riga per gli attuali e una riga distinta per i temporanei quando sono positivi, separate da 2 px, e tono `hitPointTone`;
- a 0 HP, barra vuota con bordo tratteggiato, così resta riconoscibile senza colore.

**Numero esatto.** «9/20» è sempre centrato nella riga degli attuali; «+5 temp» è sempre centrato nella riga temporanea quando presente. La barra ha una larghezza minima per leggere le cifre anche su token piccoli. Il testo visivo è `aria-hidden` perché il nome accessibile del token contiene gli stessi valori.

**Nome accessibile.** Il nome accessibile del token aggiunge «Punti ferita 9 su 20, 5 temporanei».

**Quando compare.** Solo con `maxHitPoints` numerico maggiore di 0, quindi mai per chi non riceve gli HP.

### 8. Comando dei punti ferita nel menu radiale

- **Quando compare.** In `TokenRadialMenu.tsx`, sul token canonico di un PG con `maxHitPoints` numerico maggiore di 0. È già vero solo per il proprietario e il Master, grazie alla sanitizzazione.
- **Voce del menu.** Un `menuitem` circolare con icona a cuore occupa l'arco delle azioni e segue l'ordine delle frecce. Il nome accessibile è «Punti ferita 9 su 20, 5 temporanei», e la didascalia al passaggio del mouse mostra «Punti ferita 9 (+5) / 20». La barra proporzionale resta soltanto sotto il token.
- **Campo vicino al cuore.** Attivare l'icona, o premere `-` o `+`, apre un pannello compatto sopra il cuore con un `<input>`, già prefissato con il segno premuto, e una riga di aiuto «Invio applica · Esc annulla». La didascalia sotto la corona non ospita più il campo; il pannello entra nella misura che mantiene visibile il menu ai bordi della mappa.
  - Il fuoco va al campo.
  - Il gestore dei tasti del menu inoltra al campo tutto tranne `Invio` ed `Esc`, così cifre e lettere non attivano condizioni né Indebolimento.
  - La propagazione verso la mappa resta fermata, come oggi.
- **Invio.** Chiama `useBattleMapState.setTokenHitPoints(tokenId, input)`, senza aggiornamento ottimistico: il conto lo fa il server, e un valore stimato potrebbe mostrare il risultato sbagliato con i temporanei. Poi aspetta lo snapshot restituito, chiude il campo e riporta il fuoco all'icona.
- **Rifiuto.** Il motivo compare accanto al campo con `role="alert"`, e il campo resta aperto.
- **`Esc`.** Nel campo chiude solo il campo; un secondo `Esc` chiude il menu, come oggi.
- **Legenda.** Aggiunge `-` e `+`.

**Alternativa scartata:** un pannello dedicato come quelli di `+` e «Aure». Costa un passaggio in più per il gesto più frequente del combattimento.

### 9. Selezione del testo al focus

Un gestore `focusin` registrato prima del montaggio React in `src/main.tsx` seleziona tutto il contenuto degli `<input>` testuali modificabili e delle `<textarea>`. Include i tipi `text`, `search`, `email`, `password`, `tel` e `url`; esclude `number`, checkbox, radio, file, campi disabilitati e `readOnly`. La delega sul documento copre anche i controlli montati in seguito, senza aggiungere un handler a ogni componente. Una volta ottenuto il focus, l'utente può posizionare di nuovo il cursore o selezionare una parte del testo.

Nel campo HP del menu, `-` e `+` preselezionati sarebbero sostituiti dalla prima cifra. Il suo `onChange` conserva il prefisso se il nuovo testo non inizia con un segno e non è vuoto; cancellare il segno o scriverne un altro resta possibile. La scheda usa la selezione globale senza adattamenti.

### 10. Ritratto sul token canonico

`App.tsx` riceve già il roster delle schede con `portraitUrl` per ogni proprietario e aggiorna i riferimenti tramite l'evento SSE pubblico `character-sheet-portrait`. Passa a entrambi i `Board` una mappa `ownerUserId → portraitUrl`. `Board.tsx` fornisce l'URL a `Token.tsx` solo per un token `player` canonico, non per un famiglio. `Token.tsx` lo usa come sorgente dell'immagine se presente, altrimenti conserva `token.imageUrl`. La query `v` nell'URL cambia a ogni upload valido e forza il caricamento del nuovo file.

Il ritratto resta nella scheda: nessuna modifica a `UnitToken`, snapshot, normalizzazione o autorizzazione. L'endpoint del ritratto è già leggibile dai partecipanti autenticati che ricevono il riferimento. Il controllo va fatto con un proprietario, il Master e un altro Adventurer, oltre ai token senza ritratto e ai familiari.

## Risks / Trade-offs

- **La sanitizzazione dipende dall'ordine rispetto alla normalizzazione.** Se si rimuovono gli HP prima, la derivazione li rimette. Mitigazione: rimozione dopo la normalizzazione, con un test che controlla lo snapshot di un Adventurer.
- **Transizione e annullamento del Master.** Un annullamento a snapshot della mappa può togliere Privo di sensi a un PG ancora a 0 HP. Lo accettiamo: le condizioni restano modificabili a mano, e l'automatismo scatta solo sulle transizioni.
- **Temporanei non numerici.** Un testo libero nel campo temporanei viene trattato come 0 per il danno e lasciato invariato. È documentato, così non sorprende.
- **Un valore assoluto negativo non è più possibile nel campo «Attuali»,** perché `-N` diventa danno. Uno snapshot di scheda con un valore negativo salvato resta leggibile come testo, ma non produce transizioni finché non viene riscritto.
- **Famiglio.** I suoi HP restano del token e non hanno ancora una superficie di modifica: il limite è già noto da `p0-8c` fino a P0.9.
- **Arco delle azioni più denso.** L'icona HP si dispone accanto alle altre azioni; la spaziatura dipende dal numero di comandi. Va verificata su token piccoli e allo zoom minimo.
- **Nessun aggiornamento ottimistico dal menu.** Il valore arriva dopo il giro sul server. È accettato per non mostrare un conto stimato sbagliato.
- **Click e selezione iniziale.** La selezione avviene solo quando un controllo ottiene il focus; un click successivo sullo stesso campo mantiene la normale possibilità di posizionare il cursore.

## Migration Plan

- **Schede.** Nessuna migrazione SQLite: i campi esistono già.
- **Snapshot.** Alla prima normalizzazione gli HP dei token dei PG si riallineano alla scheda. Gli HP dei nemici restano invariati.
- **Rollback.** Tornare indietro riporta il testo `attuali/massimi` visibile a tutti e il campo `set` diretto; nessun dato va convertito.
