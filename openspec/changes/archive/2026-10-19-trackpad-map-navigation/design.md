## Context

Motivazione in `proposal.md` → Why; requisiti osservabili nel delta `specs/session-workspace/spec.md`.

Vincoli del codice attuale che determinano l'approccio:

- `camera` è `useState<GridPosition>` interno a `Board` e vale **celle intere**. Non è mai applicata come singola trasformazione CSS: ogni elemento calcola la propria posizione inline con `(point.x - camera.x) * cellSize * zoom`. Circa venti punti fanno questa conversione mondo→schermo, tutti lineari e quindi già compatibili con una camera frazionaria.
- La conversione inversa passa da un solo punto, `viewportPointToWorldCell` in `src/utils/board.ts`, usata da dodici siti di chiamata in `Board.tsx` per selezione, pianificazione del movimento, righello, sagome, ping, piazzamento luci e ostacoli. Arrotonda la cella **prima** di sommare la camera, quindi con una camera frazionaria restituirebbe una cella frazionaria: è il vero punto di rottura del cambio.
- La griglia non è composta da nodi per cella: è un pattern CSS su `.board-stage` dimensionato con `backgroundSize: cellSize * zoom`. Allinea correttamente solo perché la camera è intera; non esiste oggi un `backgroundPosition`.
- Gli assi di coordinate rendono `camera.x + index` e `camera.y + index` come etichette. Con una camera frazionaria stamperebbero valori come `3.4` e si disallineerebbero dalla griglia.
- `zoom` non vive in `Board`: è una preferenza locale in `useBattleMapState`, con un `useEffect` che scrive in `localStorage` a **ogni** variazione. `Board` la riceve come prop e la cambia con `onZoomChange`.
- La nebbia e la luce non costano quanto il viewport: `buildVisionPolygon` traccia un poligono dai bloccanti, indipendente dal numero di celle visibili. `buildVisibleCellSet`, che invece itera su tutto il viewport, è esportata ma non ha chiamanti.
- Sulla mappa `Space` è l'unico gesto di conferma di un movimento pianificato e il tasto destro apre il menu radiale, annulla un piano e ha già un guard su `contextmenu`. Entrambi sono indisponibili come modificatori di navigazione.

## Goals / Non-Goals

**Goals:**

- Instradare pinch e scorrimento del trackpad dallo stesso evento `wheel`, senza dipendere da API non standard.
- Rendere la camera frazionaria mantenendo **un solo** confine di conversione verso le celle intere, così che la correttezza del piazzamento si verifichi in un punto e non in dodici.
- Coalescere le variazioni continue in un frame, perché la board non ha una trasformazione unica e ogni frame ridisegna il sottoalbero.

**Non-Goals:**

- Gesti da touchscreen vero, cioè due `pointerId` attivi con rapporto delle distanze. Il pinch del trackpad arriva come `wheel`, quindi il touchscreen è un percorso separato e non serve a questo cambio.
- Inerzia o momentum dopo il rilascio del gesto.
- L'interruttore utente per invertire rotella e scorrimento, presente in Figma e Miro. Resta un'opzione se l'euristica si rivelasse insufficiente.
- Zoom-to-fit, minimappa, doppio click per ingrandire.
- Applicare la camera come singola trasformazione CSS del palco. Sarebbe una riscrittura del rendering della board, fuori scopo qui.

## Decisions

### D1 — Un solo gestore `wheel`, diramato su `ctrlKey`

Il browser sintetizza il pinch del trackpad come `wheel` con `ctrlKey: true`: vale per Chrome, Edge e Safari su macOS e per i touchpad Windows con driver Precision. Lo scorrimento a due dita arriva come `wheel` con `deltaX`/`deltaY` e `ctrlKey: false`. Un solo gestore copre quindi entrambi i gesti del requisito.

Alternative scartate: `gesturestart`/`gesturechange`, che sono proprietarie WebKit e ridondanti rispetto a `ctrlKey`; i Pointer Events multi-touch, che servono al touchscreen e non al trackpad.

Il gestore resta registrato con `{ passive: false }` e continua a chiamare `preventDefault()`, come oggi, altrimenti il pinch diventa lo zoom della pagina e lo scorrimento porta via la pagina sotto la mappa. Allo stage va aggiunto `touch-action: none`.

### D2 — Euristica rotella/trackpad, con ricaduta sullo zoom

La decisione di prodotto è che la rotella continui a ingrandire. Quindi per un `wheel` **senza** `ctrlKey` serve distinguere la sorgente: trackpad → sposta la visuale, rotella → ingrandisce.

Segnali, in ordine:

1. `deltaMode !== DOM_DELTA_PIXEL` (righe o pagine): è una rotella.
2. `deltaX !== 0`: è un trackpad. Una rotella verticale non produce asse orizzontale.
3. `Math.abs(deltaY) >= 50`: è una rotella. Le rotelle classiche emettono scatti di 100 o 120.
4. Ogni altro delta in pixel, cioè piccolo, è un trackpad.

La prima versione considerava ambiguo un `deltaY` piccolo, intero e senza `deltaX`, e lo trattava come rotella. In uso si è rivelato sbagliato: i touchpad Precision di Windows emettono spesso delta interi, e uno scorrimento solo verticale non ha `deltaX`, quindi veniva preso per zoom. Un delta piccolo è quindi sempre trackpad. Il costo è il rischio già noto delle rotelle ad alta risoluzione (vedi Risks). La classificazione viene **fissata per la durata di una raffica** di eventi (stessa raffica finché gli eventi distano meno di un centinaio di millisecondi), perché una raffica di trackpad contiene sia delta grandi che piccoli e riclassificare a metà gesto farebbe alternare pan e zoom nello stesso movimento.

Alternativa scartata: trattare ogni `wheel` senza `ctrlKey` come spostamento, cioè la convenzione di Miro e Figma. Elimina l'euristica ma cambia l'abitudine di ogni utente mouse attuale, e la scelta di prodotto è stata di non farlo.

### D3 — Zoom moltiplicativo, non additivo

`zoom * Math.exp(-deltaY * k)` invece di `zoom ± zoomStep`. Un fattore moltiplicativo è percepito uniforme a ogni scala, mentre un passo additivo di `0.2` è sproporzionato fra un estremo e l'altro della scala. Essendo proporzionale a `deltaY`, l'ampiezza del gesto governa l'ampiezza dello zoom, che è ciò che il requisito chiede e che il passo fisso odierno non può fare.

I limiti restano `0.6`–`2.2`: l'allargamento a `0.25`–`4` inizialmente previsto è stato provato e scartato in uso, perché lo zoom-out risultante mostrava molto più tavolo di quello utile. I pulsanti `+` e `−` passano a un fattore moltiplicativo condiviso, così che pulsanti e gesti attraversino gli stessi livelli. `k` va calibrato separatamente per il pinch e per la rotella: la stessa costante rende la rotella troppo lenta o il pinch nervoso.

### D4 — Zoom ancorato al puntatore

Si conserva la coordinata mondo sotto il puntatore:

```
world   = camera + (client - rect.origin) / (cellSize * zoom)
camera' = world  - (client - rect.origin) / (cellSize * zoom')
```

Il calcolo vive in `Board`, che possiede sia `camera` che il nuovo `zoom`, quindi non serve alzare la camera nel hook. `onZoomChange` e `setCamera` chiamati nello stesso gestore sono raggruppati in un solo render da React 18.

Ancorare al puntatore è la ragione per cui la camera deve diventare frazionaria: la correzione richiesta è quasi sempre una frazione di cella, e arrotondarla reintroduce esattamente la deriva che il requisito vieta. I pulsanti `+` e `−` non hanno un puntatore e conservano invece il centro della visuale.

### D5 — Camera frazionaria con un solo confine verso le celle intere

`GridPosition` accetta già valori frazionari e `clampCamera` va rilassato al solo limite inferiore continuo. La correzione centrale è una riga in `viewportPointToWorldCell`:

```ts
// prima: una camera frazionaria produce una cella frazionaria
x: Math.floor(xInBoard / BOARD_CONFIG.cellSize) + camera.x,
// dopo: la cella si arrotonda dopo aver sommato la camera
x: Math.floor(xInBoard / BOARD_CONFIG.cellSize + camera.x),
```

Con camera intera i due sono equivalenti, quindi nessun chiamante cambia comportamento se non per l'errore che il cambio elimina. La firma resta identica e i dodici siti di chiamata restano invariati: è il motivo per cui questa funzione, e non una nuova astrazione, è il confine. Le posizioni dei token restano intere in ogni caso, perché nascono da qui.

Le conversioni mondo→schermo non richiedono nulla: sono lineari in `camera`.

### D6 — Allineamento di griglia e assi alla parte frazionaria

Due superfici assumono oggi una camera intera e vanno corrette insieme:

- La griglia riceve un `backgroundPosition` pari a `-frac(camera) * cellSize * zoom` su entrambi gli assi, altrimenti resta agganciata al bordo del palco mentre il contenuto scorre di frazioni di cella.
- Gli assi di coordinate ricavano l'etichetta da `Math.floor(camera) + index` e la striscia si sposta della stessa frazione della griglia. Senza la prima correzione mostrerebbero `3.4`; senza la seconda i numeri scivolerebbero rispetto alle colonne che etichettano.

### D7 — Coalescenza in `requestAnimationFrame`

Un trackpad emette dell'ordine di cento eventi `wheel` al secondo. Poiché la board non ha una trasformazione unica, ogni cambio di camera ridisegna il sottoalbero, quindi un `setState` per evento è insostenibile. I delta si accumulano in un `ref` e si applicano una volta per frame.

Due conseguenze da trattare nello stesso cambio:

- Il `useEffect` che scrive `zoom` in `localStorage` scatta a ogni variazione: con lo zoom continuo diventa una scrittura per frame. Va reso pigro, scrivendo alla quiete del gesto.
- I memo del poligono di visione e di luce dipendono da `camera.x`, `camera.y` e `zoom`, quindi ricalcolano il ray-cast a ogni frame di spostamento pur avendo una geometria che dipende solo dai bloccanti. Vanno separati in due livelli: geometria mondo memoizzata sui bloccanti, proiezione a schermo memoizzata su camera e zoom.

Il costo per frame che resta è dominato dalle etichette degli assi, il cui numero cresce al ridursi dello zoom: a zoom minimo sono qualche centinaio di nodi ricreati per frame. Va misurato prima di introdurre una virtualizzazione che a questo scopo sarebbe prematura.

### D8 — Nessun gesto di navigazione nuovo oltre a quelli del trackpad

`Ctrl`+trascinamento e tasto centrale restano come sono, ora continui. La barra spaziatrice resta la conferma del movimento e il tasto destro resta il menu radiale: il delta li dichiara riservati, così che la scelta non venga riaperta a ogni proposta successiva. Non c'è conflitto fra `Ctrl`+trascinamento e `Ctrl`+`wheel`: sono eventi distinti.

`panStep: 6` in `src/constants/board.ts` è dichiarato e non ha consumatori. Va rimosso mentre si tocca quel file, perché lasciarlo accanto ai nuovi limiti suggerisce un passo di spostamento che non esiste.

### D9 — `Ctrl`+rotella sposta la visuale in verticale; la sorgente si distingue dalla forma, non da `ctrlKey`

Riscontro d'uso: la sola diramazione su `ctrlKey` (D1/D2) lascia senza un gesto comodo lo spostamento verticale con mouse su una board più alta della finestra. La correzione **non** aggiunge un terzo tasto: ridefinisce cosa significa `ctrlKey` per ciascuna sorgente, perché rotella e trackpad restano comunque distinguibili dalla forma del delta indipendentemente da `ctrlKey` — il pinch sintetizzato ha comunque delta piccoli e frazionari, una vera pressione di `Ctrl` con rotella fisica ha comunque delta grandi o a righe.

`classifyWheelGesture` si divide quindi in due funzioni pure: `classifyWheelSource` (rinominata, stessa euristica di D2, restituisce `'wheel' | 'trackpad'`, non più `'zoom' | 'pan'`) e `wheelAction({ ctrlKey, altKey }, source)`, che applica la tabella prodotto:

| sorgente \ modificatore | nessuno | `Ctrl` | `Alt` |
|---|---|---|---|
| rotella | zoom (ancorato al cursore) | pan verticale | pan orizzontale |
| trackpad | pan su due assi | zoom (pinch, ancorato alle dita) | pan su due assi |

La classificazione della sorgente resta fissata per raffica come in D2; solo l'azione risultante cambia in base ai modificatori, letti ad ogni evento (non hanno bisogno di essere fissati: non oscillano a metà gesto). Il pan da rotella riusa la stessa conversione delta→celle del pan da trackpad su un solo asse. `Alt` porta la rotazione verticale della rotella sull'asse orizzontale, con il verso di `Shift`+rotella nei browser: verso il basso va a destra. Se `Ctrl` e `Alt` sono premuti insieme vince `Ctrl`.

### D10 — Nessun tetto sul numero di celle visibili

Un tetto fisso di celle visibili (provato a 26, `A`–`Z`) rompe la mappa: il palco è largo `colonne × cellSize` non scalato dallo zoom, quindi con un tetto non copre più uno schermo largo. L'estensione visibile resta governata solo dallo zoom, con il pavimento `minVisibleColumns`/`minVisibleRows` a 30.

## Risks / Trade-offs

- **Un mouse con rotella ad alta risoluzione a scorrimento libero emette delta piccoli in pixel e viene classificato come trackpad, quindi sposta la visuale invece di ingrandire.** → È l'unica regressione plausibile per un utente mouse. La classificazione fissata per raffica (D2) limita il danno a gesti interi e non a metà movimento; la via d'uscita, se emerge in uso reale, è l'interruttore utente già escluso dai Non-Goals, non un'euristica più elaborata.
- **Una camera frazionaria che raggiunge un calcolo di celle non censito produce un piazzamento sbagliato di una cella, silenziosamente.** → `viewportPointToWorldCell` è l'unico confine (D5): la verifica consiste nell'enumerare i suoi dodici chiamanti e provare ciascuno con la visuale fermata a metà cella, non nel fidarsi della compilazione. Gli assi e la griglia (D6) sono i due punti che assumono l'intero fuori da quella funzione, e sono entrambi visibili a occhio.
- **Prestazioni a zoom minimo durante uno spostamento.** → Il rischio è minore del previsto, perché la nebbia usa un poligono indipendente dal viewport e `buildVisibleCellSet` non ha chiamanti. Restano le etichette degli assi: la coalescenza per frame e la separazione dei memo (D7) sono le mitigazioni; la misura decide se serve altro.
- **`preventDefault()` su ogni `wheel` sopra la mappa impedisce di scorrere la pagina col trackpad quando il puntatore è sulla mappa.** → È già il comportamento odierno e il requisito lo vuole, perché il gesto appartiene alla mappa. La mappa non è l'intera pagina, quindi resta una via di scorrimento attorno.
- **Touchpad Windows senza driver Precision emulano una rotella con delta grandi.** → Ricadono sullo zoom, cioè sul comportamento odierno: perdono il nuovo gesto ma non ne guadagnano uno sbagliato. È la ricaduta che il delta prescrive.
- **Il ritardo sulla scrittura in `localStorage` (D7) può perdere l'ultimo ingrandimento se la scheda viene chiusa durante il gesto.** → Perdita accettabile per una preferenza di presentazione, che `readStoredZoom` ridimensiona comunque all'apertura.

## Migration Plan

Nessuna migrazione di dati: nulla entra nello stato condiviso, negli endpoint o negli snapshot persistiti. L'unico valore persistito è lo `zoom` in `localStorage`, che `readStoredZoom` già ridimensiona con `clampZoom` in lettura.

Il ridimensionamento in lettura rende sicuro anche il rollback: uno zoom `3.5` salvato con i limiti nuovi viene riportato a `2.2` dal codice precedente, senza errori e senza toccare le altre preferenze. Il rollback è quindi il semplice ripristino del commit.
