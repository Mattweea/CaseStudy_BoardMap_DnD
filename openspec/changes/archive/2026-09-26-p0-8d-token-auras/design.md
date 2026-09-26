## Context

La motivazione è in `proposal.md`. Stato attuale rilevante:

- **Aure sul token.**
  - `TokenAura` in `src/types/index.ts` ha la forma `{ id, radiusCells, isVisible, color }`.
  - Il server la normalizza in `server/index.mjs`, conservando anche la vecchia forma a singola aura.
  - `Board.tsx` (`auraCircles`) la disegna come cerchio dal centro dell'ingombro.
  - L'unica superficie di modifica è la sezione «Aura» di `EditElementModal`, nascosta da `p0-8c`. `updateOwnedToken` accetta ancora `auras` nel payload.
- **Scheda privata.** `CharacterSheetService` consegna la scheda solo al proprietario e al Master, e lo snapshot della mappa non la incorpora. La proiezione verso il token è a senso unico (`#projectOperations` → `projectCharacterSheetToToken`) e oggi reagisce solo a operazioni `set` su percorsi fissi (nome, HP, velocità, iniziativa).
- **Collezioni della scheda.** Sono righe piatte in `CHARACTER_COLLECTIONS` di `server/character-sheet-schema.mjs`, modificate con la grammatica di patch `character.<collezione>.<id>.<campo>`. Le liste sono array con `id` stabili. `'integer'` è un intero conservato come testo, come `critRange`. I domini chiusi sono array di valori, come `DAMAGE_TYPES`.
- **Collegamento token-scheda.** Il server lo risolve con `characterSheetService.findIdByOwner(token.ownerUserId)` e legge il documento con `readInternal(id)` (vedi `dexModifierForToken`).
- **Unità di misura.** `measurementUnit` (`{ label, cellsValue }`) sta nello stato condiviso ed è scelta dal Master.
- **Menu radiale.** `TokenRadialMenu.tsx` usa questi tasti d'accesso:
  - condizioni delle creature: `P A T V C F D S I B R E O N`;
  - «Alzati»: `L`.

  Tra i liberi c'è `U`. Le azioni «Alzati» e «Scatto» stanno nella riga sotto la corona; il pannello `+` ha già il posizionamento dentro lo stage.

## Goals / Non-Goals

**Goals:**

- Una sola fonte delle aure, la scheda, con una proiezione sul token che nessun client può falsificare.
- Una sola funzione di area e presenza, condivisa da server, mappa e avviso.
- Nessuna fuga di dati privati: la descrizione resta nella scheda e un proprietario nascosto non si rivela.

**Non-Goals:**

- Qualunque effetto meccanico, destinatario, promemoria o immunità.
- Aure dei PNG, aure ancorate o a cono, aura da dentro un veicolo.
- Annullamento dell'interruttore.
- Resa su touch.

## Decisions

### 1. Modello nella scheda

Nuova collezione `auras` in `CHARACTER_COLLECTIONS`:

| Campo | Regola | Default di una riga nuova |
|---|---|---|
| `name` | `'text'`, al massimo 60 caratteri | `''` (mostrato «Aura») |
| `description` | `'text'` | `''` |
| `effect` | `'text'`, al massimo 500 caratteri | `''` |
| `radiusCells` | `'integer'`, da 1 a 24 | `'2'` |
| `color` | `AURA_COLORS`, dominio chiuso | primo colore della palette |
| `active` | `'boolean'` | `false` |

- **Limiti.** Lunghezze, intervallo del raggio e il massimo di 10 righe si aggiungono alla validazione del documento completo, così una patch che li viola viene rifiutata per intero, come oggi.
- **Default.** Vanno in `COLLECTION_FIELD_DEFAULTS`.
- **Documenti esistenti.** `normalizeCharacterSheetData` crea la collezione vuota quando manca. Nessuna migrazione SQLite, perché il documento è JSON.

**Alternativa scartata:** aure nello stato della mappa, modificate da un endpoint. Duplicherebbe la persistenza della scheda, e la definizione di un personaggio sparirebbe alla prima sessione nuova.

### 2. Modulo condiviso `shared/token-auras.mjs`

Esporta:

| Nome | Contenuto |
|---|---|
| `AURA_COLORS` | la palette chiusa (otto colori leggibili sulla mappa scura) |
| `AURA_LIMITS` | `{ maxAuras: 10, minRadiusCells: 1, maxRadiusCells: 24, maxNameLength: 60, maxEffectLength: 500 }` |
| `radiusCellsFromUnit(value, cellsValue)` | `Math.max(1, Math.round(value / cellsValue))`, limitato a `maxRadiusCells` |
| `projectSheetAuras(rows)` | `[{ id, name, effect, radiusCells, color, active }]`, senza `description` |
| `auraRect(ownerToken, radiusCells)` | `{ x, y, width, height }` in caselle: l'ingombro allargato di `radiusCells` per lato |
| `isTokenInAura(target, ownerToken, aura)` | intersezione fra l'ingombro di `target` e `auraRect` |
| `auraPresenceFor(state, userId)` | le righe dell'avviso: `{ key, subjectTokenId, isFamiliar, subjectName, ownerName, auraName, effect }` |

L'ingombro usa lo stesso calcolo della mappa (dimensioni esplicite, altrimenti la taglia). `auraPresenceFor` salta:

- gli owner contenuti in un veicolo;
- le aure spente;
- le aure il cui owner ha lo stesso `ownerUserId` del soggetto.

Restituisce un array vuoto per il Master.

**Perché un rettangolo e non un insieme di caselle:** con la griglia del PHB la distanza è di Chebyshev. La distanza dall'ingombro è quindi il massimo delle distanze per asse, e l'area è esattamente un rettangolo. Presenza e disegno diventano un confronto fra intervalli, senza enumerare caselle.

### 3. Proiezione derivata sul server

- **Normalizzatore.** Il normalizzatore del server riceve un risolutore `resolveTokenAuras(token)`. Per un token `player`, non famiglio, con `ownerUserId`, il risolutore legge la scheda collegata (`findIdByOwner` + `readInternal`) e restituisce `projectSheetAuras`. Per ogni altro token, e in caso di scheda assente o di errore di lettura, restituisce `[]`.
- **Valore in ingresso ignorato.** Il normalizzatore **ignora sempre** `token.auras` in ingresso. Il valore sul token è quindi sempre quello della scheda, su ogni percorso che installa uno stato:
  - commit a stato pieno;
  - `updateOwnedToken`;
  - annullamento del Master;
  - ripresa di una sessione;
  - creazione del token al login.

  Le forme legacy spariscono per costruzione.
- **Patch della scheda.** `#projectOperations` riconosce ogni operazione (`set`, `add`, `remove`) con percorso che inizia per `character.auras`, e chiede la proiezione del token (`projectToken(ownerUserId, {})`). La normalizzazione successiva rilegge le aure, e il server incrementa la versione e trasmette lo snapshot.
- **Normalizzatore client.** Valida la nuova forma e scarta le voci che non la rispettano. Non ricostruisce nulla.

**Alternativa scartata:** aggiornare `token.auras` solo alla patch, come per gli HP. Un annullamento del Master o una ripresa rimetterebbero aure vecchie in disaccordo con la scheda, e un commit a stato pieno potrebbe inventarle.

**Costo:** `readInternal` usa la cache `live` del servizio. Le letture sono una per personaggio a ogni normalizzazione, con un roster di pochi personaggi.

### 4. Interruttore

Nuovo endpoint `POST /api/battle-map/token-auras` con corpo `{ tokenId, auraId, active }`.

**Controlli, in quest'ordine:**

| Caso | Esito |
|---|---|
| token inesistente | `404` |
| token che non è il canonico di un personaggio (famiglio, nemico, oggetto, veicolo) | `400` |
| né Master né proprietario | `403` |
| scheda assente | `404` |
| aura assente nella scheda | `404` |
| `active` non booleano | `400` |

**No-op:** se lo stato è già quello richiesto, l'endpoint restituisce lo snapshot senza patch e senza incrementare la versione.

**Applicazione:** `characterSheetService.applyPatch(user, sheetId, { baseVersion: <versione live>, operations: [{ op: 'set', path: 'character.auras.<auraId>.active', value }] })`, con lo stesso schema degli effetti collaterali del resolver dei tiri. La patch passa per la validazione, l'evento SSE della scheda, il debounce verso SQLite e la proiezione del punto 3.

**Risposta:** lo snapshot sanitizzato per chi chiama. Sul rifiuto il corpo contiene il motivo e lo snapshot.

**Annullamento:** nessuna azione inversa per l'Adventurer, nessun annullamento a snapshot per il Master.

**Modalità di sessione:** valida in ogni modalità.

**Alternativa scartata:** il client invia la patch direttamente sulla scheda. Il menu radiale non ha la scheda caricata né la sua versione, e per il Master aprire ogni scheda solo per un interruttore sarebbe una forzatura.

### 5. Visibilità

La sanitizzazione esistente rimuove i token con `isInvisible` non propri, e con loro le aure che portano. Non serve un filtro nuovo. `auraPresenceFor` lavora sullo stato già sanitizzato, quindi un owner nascosto non produce righe. L'area delle aure spente non si disegna, ma la voce resta nel token perché il menu del proprietario e del Master ne ha bisogno.

### 6. Resa sulla mappa

- **Livello.** `auraCircles` diventa `auraRects`: per ogni aura accesa, un rettangolo di riempimento e uno di bordo calcolati con `auraRect` e trasformati con camera e zoom, nel livello attuale sotto i token.
- **Stile.** I riempimenti a bassa opacità stanno in un gruppo SVG isolato e usano `mix-blend-mode: multiply`: la zona comune combina i colori delle aure senza moltiplicarli con la mappa sottostante. I bordi pieni di 2 px vengono disegnati in un secondo passaggio, sopra tutti i riempimenti, nel colore originale di ogni aura.
- **Esclusioni.** Nessun rettangolo per un owner con `containedInVehicleId`.
- **Master.** Vede anche le aure dei token nascosti, coerentemente con i token fantasma.

### 7. Avviso di presenza

- **Componente.** Nuovo `AuraPresenceBanner`, montato da `App.tsx` nell'host attivo della mappa (normale o schermo intero, come l'overlay dei dadi), in alto al centro, sopra la mappa e sotto le modali.
- **Dati.** È alimentato da `auraPresenceFor(state, user.id)` in `useMemo` sullo stato condiviso, quindi si aggiorna a ogni snapshot.
- **Righe.** Ogni riga è un `<button aria-expanded>` con il testo:
  - «Sei nell'aura di <personaggio>: <nome>»;
  - «<famiglio> è nell'aura di <personaggio>: <nome>» per un famiglio.

  Espansa, mostra l'effetto, oppure «Nessun effetto indicato» se è vuoto. La forma «dell'aura di X: nome» evita l'articolo davanti a un nome arbitrario.
- **Annunci.** Una regione `role="status"` visivamente nascosta annuncia solo le righe nuove, confrontando le chiavi con il render precedente. Nessuno spostamento del fuoco.
- **Master e righe vuote.** Il Master non monta il componente. Senza righe, il componente non occupa spazio.

### 8. Menu radiale

- **Voce.** «Aure» è un'azione nella riga sotto la corona, accanto ad «Alzati» e «Scatto», con tasto d'accesso `U`. Compare solo per il token canonico di un personaggio con `auras.length > 0`, per chi può già aprire il menu, cioè il proprietario o il Master.
- **Scatto.** Sul proprio token personaggio resta nella riga delle azioni indipendentemente dalle aure. `canDashTokenIds` ne determina l'attivazione; fuori turno o prima dell'avvio del round resta disabilitato con un motivo leggibile nel menu, senza inviare la mutazione. Il Master continua a non riceverlo perché la rotta dello scatto è riservata al proprietario.
- **Pannello.** Apre un pannello con la stessa logica di posizionamento del pannello `+`. Ogni aura è un `menuitemcheckbox` con campione di colore, nome e `aria-checked`.
- **Tastiera.** Frecce per navigare, `Invio` o `Spazio` per attivare, `Esc` per tornare alla corona.
- **Mutazione.** `useBattleMapState.setTokenAuraActive(tokenId, auraId, active)` aggiorna in modo ottimistico `token.auras[].active`, e sul rifiuto applica lo snapshot restituito e mostra il motivo nel toast esistente.
- **Legenda.** Aggiunge `U`.

### 9. Scheda

- **Sezione.** Nuova sezione «Aure» in `CharacterTab.tsx`, dopo «Privilegi e tratti».
- **Righe compatte:** campione di colore, nome, raggio nell'unità della partita, interruttore acceso/spento. L'interruttore è una patch `set` diretta sul campo `active`, lo stesso campo del menu.
- **Editor dedicato** in `RowEditor.tsx`, sul modello di attacchi e strumenti: nome, descrizione, effetto, raggio nell'unità e palette. Alla conferma invia le differenze come patch; all'annullamento non invia nulla.
- **Unità.** `CharacterSheetWindow` riceve `measurementUnit` da `App.tsx`. La conversione passa da `radiusCellsFromUnit`, e il raggio si mostra come caselle × `cellsValue` con l'etichetta dell'unità.

### 10. Pulizia

- **`TokenAura`.** Diventa `{ id, name, effect, radiusCells, color, active }`.
- **`EditElementModal`.** Perde la sezione «Aura» e l'invio di `auras`. Il componente resta nascosto e compilabile.
- **`updateOwnedToken`.** Smette di inoltrare `auras`. La normalizzazione le ignorerebbe comunque; lo stesso per il commit a stato pieno.

## Risks / Trade-offs

- **Il normalizzatore del server dipende dal servizio delle schede, quindi non è più puro.** Mitigazione:
  - il risolutore è iniettato e ha un default che restituisce `[]`;
  - ogni errore di lettura restituisce `[]`;
  - i test usano un risolutore finto;
  - lo stato iniziale, creato prima del servizio, nasce senza aure e si allinea alla prima normalizzazione successiva.
- **Una ripresa che cambia utenti o schede.** Una sessione salvata può nominare owner che ora non hanno una scheda. Il risolutore restituisce `[]` e l'aura semplicemente non compare.
- **Il toggle non è annullabile.** È una scelta voluta: un secondo toggle lo corregge senza toccare la cronologia della scheda. Documentato nella sezione di annullamento di `Docs/ai`.
- **Righe tante nell'avviso.** Con molte aure sovrapposte l'avviso si allunga. Il massimo teorico, 10 aure per personaggio per pochi personaggi, resta leggibile. Non introduciamo un compattamento finché non serve.
- **La regola PHB diverge dal righello con 5-10-5.** È una scelta dell'utente, dichiarata nella spec con uno scenario, così non sembra un bug.
- **Perdita delle aure legacy.** Le aure esistenti sui nemici spariscono fino a P0.9. È accettato nel brainstorming e marcato **BREAKING** nella proposal.

## Migration Plan

- **Schede.** Nessuna migrazione SQLite. La collezione vuota nasce alla normalizzazione.
- **Snapshot.** Le aure legacy spariscono alla prima normalizzazione, per derivazione.
- **Rollback.** La versione precedente non ignora la collezione `auras`: la validazione a chiavi esatte (`exactKeys` sulle chiavi di `character`) rifiuterebbe il documento. Prima di un rollback bisogna quindi rimuovere la collezione dai documenti salvati. Il rollback non è previsto oltre lo sviluppo locale; lo annotiamo nel riepilogo della change.
