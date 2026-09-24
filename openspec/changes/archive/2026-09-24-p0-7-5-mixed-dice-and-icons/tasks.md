## 1. Motore condiviso

- [x] 1.1 Aggiungere il segno esplicito al gruppo normalizzato in `shared/dice-engine.mjs`, mantenendo `count >= 1`; verificare con un test in `test/dice-engine.test.mjs` che un gruppo sottratto abbassa il totale del gruppo e che nessun dado generato espone un valore negativo
- [x] 1.2 Esporre da `resolveDiceRoll` un totale aggregato che somma i gruppi rispettandone il segno, lasciando invariati `formula`, `rolls`, `keptRolls`, `modifier` e `total`; verificare con un test su un tiro a tre gruppi in cui il totale aggregato differisce dal campo legacy, così che una futura confusione fra i due fallisca
- [x] 1.3 Documentare nel commento di `resolveDiceRoll` e nei tipi che i campi legacy descrivono il primo gruppo; verificare che `npx tsc -b` resti pulito
- [x] 1.4 Verificare con un test che `mode` diverso da `normal` continua a essere rifiutato quando i gruppi non sono esattamente un `d20` singolo, come già impone il motore

## 2. Parser e validazione autorevole

- [x] 2.1 Riscrivere `parseRollFormula` in `server/authoritative-roll.mjs` come scansione di termini firmati, restituendo la lista dei gruppi e il modificatore complessivo; verificare in `test/authoritative-roll.test.mjs` che `1d20+5 + 6d4`, `1d20 + 5 + 6d4` e `1d20+5+6d4` producano la stessa formula normalizzata (delta: scenario "Spaziatura irrilevante")
- [x] 2.2 Accettare i gruppi sottratti e propagarne il segno al motore; verificare con un test su `1d8 - 1d4` che il subtotale del `d4` sia sottratto e che i dadi del log restino positivi (delta: scenario "Gruppo sottratto")
- [x] 2.3 Fissare i tetti complessivi su numero di dadi, numero di gruppi e valore assoluto del modificatore complessivo, scegliendo il tetto dei dadi in rapporto esplicito a `MAX_PRESENTATION_DICE`; verificare con un test che gruppi singolarmente validi ma complessivamente eccedenti vengano rifiutati (delta: scenario "Limiti superati da gruppi combinati")
- [x] 2.4 Rendere l'errore di rifiuto specifico sul termine o sul limite violato; verificare con test che una formula malformata e una fuori limite producano messaggi distinti e che nessun tiro entri nel log (delta: scenario "Formula non valida")
- [x] 2.5 Rifiutare una formula che mescola un gruppo di `d20` ad altri gruppi, con un errore che spieghi che il `d20` si tira da solo invece di dire soltanto che la formula non è valida; verificare con un test su `1d20+5 + 6d4` (delta: scenario "d20 rifiutato in una formula mista")
- [x] 2.6 Risolvere un solo `d20` come `unresolved` e rifiutare una `mode` dichiarata dal client per il tiro libero; verificare con test che `1d20+5` produca due esiti indipendenti con il modificatore su entrambi e che una richiesta con `advantage` sia respinta (delta: scenari "Un d20 produce due esiti" e "Modalità dichiarata dal client rifiutata")
- [x] 2.7 Trattare `Xd20` con `X` maggiore di uno come esiti indipendenti senza semantica di coppia; verificare con un test che `3d20` produca tre esiti nessuno dei quali marcato come alternativa (delta: scenario "Più d20 restano indipendenti")
- [x] 2.8 Contare i dadi **generati** e non quelli scritti in formula nel tetto complessivo, dato che un `1d20` ne produce due; verificare con un test al confine che il conteggio usato sia quello generato
- [x] 2.9 Popolare `parts` sul log del tiro libero quando i gruppi sono più di uno, riusando la forma già prodotta da `character-sheet-roll-resolver`; verificare con un test che un tiro a gruppo singolo continui a non produrre `parts` (delta: scenario "Log storico a gruppo singolo")
- [x] 2.10 Verificare con un test che una formula storica a gruppo singolo resti valida e produca gli stessi criteri di calcolo (delta: scenario "Ripetizione di un tiro storico")

## 3. Presentazione 3D

- [x] 3.1 Verificare con un test in `test/dice-3d-presentation.test.mjs` che `buildDicePresentation` costruisca una notazione corretta da un log con più tipi di dado e conservi i gruppi logici distinti
- [x] 3.2 Verificare con un test il comportamento al superamento di `MAX_PRESENTATION_DICE` da parte di gruppi combinati, confermando il degrado al log numerico già richiesto da `dice-3d-presentation`

## 4. Pannello di lancio

- [x] 4.1 Rendere cumulativa la selezione nella tray di `src/components/DicePanel.tsx`, rimuovendo l'azzeramento introdotto in `c936485` insieme alla sua causa; verifica manuale giustificata dall'assenza di infrastruttura di test React nel progetto: selezionare `1d8`, aggiungere `3d6`, confermare che entrambe le quantità restino visibili (delta: scenario "Selezione di più tipi di dado") — **verificato dall'utente a schermo**
- [x] 4.2 Comporre la formula dai contatori ordinando i tipi per numero di facce e rimuovere dalla selezione i tipi riportati a zero; verifica manuale: azzerare un tipo e confermare che sparisca dal riepilogo e dalla formula inviata (delta: scenario "Quantità azzerata rimossa dalla selezione") — **verificato dall'utente a schermo**
- [x] 4.3 Mostrare la formula composta nel riepilogo sopra il pulsante di tiro al posto di `NdS`; verifica manuale con il numero massimo di gruppi consentito, per confermare che il riepilogo resti leggibile al limite e non solo con due gruppi — **verificato dall'utente a schermo**
- [x] 4.4 Rimuovere del tutto il selettore di modalità dalla modale e smettere di inviare `mode` dal tiro libero; verifica manuale che la modale esponga soltanto modificatore e visibilità (delta: scenario "Nessuna scelta di modalità nella modale") — **verificato dall'utente a schermo**
- [x] 4.5 Impedire nella tray di comporre una selezione che mette il `d20` insieme ad altri tipi, o lasciar rifiutare al server spiegandone il motivo a schermo; verifica manuale che il messaggio dica perché e non solo che la formula non va — **verificato dall'utente a schermo** (guardia client-side + messaggio server dedicato)
- [x] 4.6 Riconoscere `/rs` oltre a `/r` nella textarea dei comandi, con la stessa grammatica e visibilità segreta; verifica manuale che il tiro compaia come segreto e che un altro Player non lo veda (delta: scenario "Tiro segreto dal comando") — **verificato dall'utente a schermo**

## 5. Log dei tiri

- [x] 5.1 Distinguere nel ramo del tiro libero di `src/components/DiceLogEntry.tsx` il caso con `parts` da quello senza, limitando `diceSidesFromFormula` al secondo; verifica manuale: confrontare a schermo un tiro storico a gruppo singolo e un tiro nuovo a più gruppi — **verificato dall'utente a schermo**
- [x] 5.2 Mostrare per un tiro libero multi-gruppo il totale aggregato e il dettaglio per gruppo; verifica manuale che il totale corrisponda alla somma dei gruppi, inclusi quelli sottratti — **verificato dall'utente a schermo**

## 6. Card unificata del log

- [x] 6.1 Far convergere i quattro rami di `src/components/DiceLogEntry.tsx` su una card sola con intestazione, formula, totali attivabili, dettaglio condiviso e azione d'origine quando presente; verifica manuale giustificata dall'assenza di infrastruttura di test React: confrontare a schermo un tiro libero e un tiro dalla scheda (delta: scenario "Stessa card per origini diverse") — **verificato dall'utente a schermo**
- [x] 6.2 Rendere la formula visibile su ogni voce con peso tipografico inferiore al totale; verifica manuale che il totale resti l'elemento dominante anche con una formula multi-gruppo lunga — **verificato dall'utente a schermo**
- [x] 6.3 Sostituire il tooltip `title` di `PairCard` con l'espansione al click, mantenendo `aria-expanded` sul comando come già fa il ramo del tiro libero; verifica manuale con la sola tastiera che il dettaglio di un tiro dalla scheda si apra (delta: scenario "Dettaglio raggiungibile senza puntatore") — **verificato dall'utente a schermo**
- [x] 6.4 Esporre un comando per ogni totale di una voce con più risultati, aprendo un dettaglio unico che li comprende; verifica manuale su un bersaglio `1d20` doppio e su un danno a due gruppi (delta: scenario "Voce con più risultati") — **verificato dall'utente a schermo**
- [x] 6.5 ~~Marcare esplicitamente una coppia da cui scegliere~~ — deciso con l'utente di non aggiungere un marcatore testuale: la formula (`1d20` contro `2d20`) e la convenzione già nota al giocatore bastano; requisito e scenario aggiornati in `specs/session-dice-rolling/spec.md`
- [x] 6.6 Comporre la formula mostrata da tutte le parti invece di leggerla da `log.formula`, che per un danno a più blocchi contiene solo il primo; verifica manuale su un attacco con due blocchi di danno (delta: scenario "Formula completa di un tiro a più gruppi") — **verificato dall'utente a schermo**
- [x] 6.7 Omettere la didascalia quando non c'è un'azione d'origine, invece di farla ricadere su `log.label`, che per un tiro libero è la formula e comparirebbe due volte; verifica manuale su un tiro dal tray — **verificato dall'utente a schermo**
- [x] 6.8 Verificare che il dettaglio usi lo stesso componente `DiceGlyph` dei controlli di lancio; verifica manuale che l'icona di un `d8` sia identica nelle due superfici (delta: scenario "Icone coerenti fra log e controlli di lancio") — **verificato dall'utente a schermo**
- [x] 6.9 Aggiornare o rimuovere il commento di `PairCard` che dichiara «mai la formula in chiaro», ora contraddetto; se emerge un requisito che invece la vieta, sollevarlo prima di procedere invece di aggirarlo — `PairCard` e il commento sono stati rimossi con l'unificazione

## 7. Visibilità dalla scheda

- [x] 7.1 Aggiungere in testa alla scheda, accanto ai comandi di salvataggio, un interruttore fra tiri pubblici e segreti che vale per i tiri fatti da quella scheda; verifica manuale che un tiro segreto dalla scheda non raggiunga un altro Player (delta: requisito "Visibilità pubblica e segreta") — **verificato dall'utente a schermo**
- [x] 7.2 Propagare `visibility` dalle chiamate di tiro della scheda, che oggi non lo inviano mai e ricadono sempre su `public`; verificare con un test del resolver che il campo sia rispettato
- [x] 7.3 Indicare lo stato segreto **sul bersaglio del tiro**, non solo sull'interruttore, perché tirare in pubblico credendosi in segreto rivela qualcosa di irrecuperabile; verifica manuale che lo stato sia visibile nel momento del tiro (delta: scenario "Stato di visibilità persistente reso evidente") — **verificato dall'utente a schermo** (banner sticky)
- [x] 7.4 Rendere l'interruttore persistente fra le ricariche, con ambito la singola scheda e memorizzazione locale al browser come le preferenze di presentazione; verifica manuale che lo stato sopravviva a un ricaricamento e non entri nello stato condiviso — **verificato dall'utente a schermo** (`localStorage` per `sheetId`)

## 8. Presentazione 3D e disposizioni

- [x] 8.1 Rimuovere dalla presentazione la resa differenziata fra dadi `kept` e `discarded`, presentando con pari enfasi i dadi di una stessa voce; verificare con un test in `test/dice-3d-presentation.test.mjs` che una voce storica con un dado scartato sia presentata senza attenuazioni e senza errori (delta: scenario "Voce storica con esito scartato")
- [x] 8.2 Conservare il campo `disposition` nel dato, così che la distinzione resti ripristinabile senza migrazione; verificare con un test che il campo continui a essere prodotto e propagato
- [x] 8.3 Verificare che la parità degli `unresolved` e la rappresentazione percentile restino invariate (delta: scenari "Coppia non risolta" e "Casi limite percentile")

## 9. Icone e attribuzione

- [x] 9.1 Scaricare dal set poliedrico di game-icons.net gli SVG `d4`, `d6`, `d8`, `d10`, `d12`, `d20` e registrarne autore e licenza per ciascuno; verificare che ogni file abbia una provenienza tracciata prima di entrare nel repository — recuperati dalla fonte (author/license confermati pagina per pagina): `d4`=Skoll "Dice 4", `d10`=Skoll "Dice 10", `d12`=Skoll "Dice 12", `d6`=Delapouite "Cube", `d8`=Delapouite "Dice 8 faces 8", `d20`=Delapouite "Dice twenty faces twenty"; tutti CC BY 3.0
- [x] 9.2 Sostituire i tracciati in `src/components/DiceIcons.tsx` conservando firma, `currentColor` e props dei componenti; verificare che `npx tsc -b` resti pulito e che il `d100` continui a essere reso — `viewBox` passato da `0 0 24 24` a `0 0 512 512` (nativo del set) per i sei sostituiti: `width`/`height` restano governati da `size`/CSS, quindi l'ingombro nella UI è invariato; trascodere a mano le coordinate in un `viewBox` a 24 unità avrebbe rischiato di corrompere i tracciati senza alcun beneficio visibile
- [x] 9.3 Adeguare peso e contrasto delle icone piene sul tema scuro; verifica manuale a schermo nella tray, nel log e nella modale, giustificata dal fatto che nessun test automatico copre la resa visiva — **verificato a schermo dall'utente**: `fill-rule="evenodd"` aggiunto a tutte le icone piene, necessario perché il set incide il numerale di ogni faccia come un foro annidato nel tracciato (visibile contro lo sfondo nero delle preview originali del set), che senza `evenodd` la regola `nonzero` di default può annullare invece di ritagliare; `d4`, `d8`, `d10`, `d12`, `d20`, `d100` mostrano ora il numerale corretto, `d6` resta senza numerale per scelta (l'asset "Cube" non ne porta uno, nessuna alternativa nello stesso stile nel set; deciso con l'utente di lasciarlo così)
- [x] 9.4 Esporre nella tab Impostazioni l'attribuzione con nome del set, autore e licenza CC BY 3.0; verifica manuale che sia raggiungibile e identica per Master e Player (delta: scenari "Attribuzione del set di icone dei dadi" e "Attribuzione indipendente dal ruolo") — aggiunta in `App.tsx` (tab Impostazioni, non condizionata dal ruolo); la tab è stata verificata a schermo dall'utente, il testo dell'attribuzione non è stato riletto separatamente
- [x] 9.5 Se l'adozione delle icone viene rinviata, rinviare nello stesso momento anche l'attribuzione; verificare che il repository non contenga asset del set senza la riga di attribuzione corrispondente — non applicabile: le icone sono state adottate nello stesso change dell'attribuzione

## 10. Tab del pannello destro

- [x] 10.1 Ridurre l'ingombro dei pulsanti delle tab in `src/styles/index.css` in modo che le cinque voci stiano su una riga alla larghezza nominale del pannello, senza abilitare il ritorno a capo; verifica manuale alla larghezza nominale e a quella minima supportata (delta: scenario "Tab su una riga sola") — **verificato dall'utente a schermo** (`grid-template-columns` corretto da 4 a 5, ingombro ridotto)
- [x] 10.2 Verificare che la riduzione non tolga informazione, dato che l'etichetta testuale resta in `title` e `aria-label`, e che il bersaglio di click resti utilizzabile — **verificato dall'utente a schermo**
- [x] 10.3 Verificare che le cinque tab siano navigabili da tastiera e indichino quella attiva; verifica manuale giustificata dall'assenza di test React (delta: scenario "Cambio tab da tastiera") — **verificato dall'utente a schermo** (comportamento preesistente: `role="tab"`, `aria-selected`)
- [x] 10.4 Verificare che la tab Impostazioni esponga i controlli di animazione e audio e che i controlli di lancio restino disponibili in basso al cambio di tab (delta: scenario "Preferenze dei dadi raggiungibili dalla tab Impostazioni") — **verificato dall'utente a schermo** (comportamento preesistente)

## 11. Documentazione e chiusura

- [x] 11.1 Classificare l'impatto sui router `Docs/ai` applicabili (gameplay, backend, frontend) e aggiornare `Docs/ai/gameplay/combat_movement_and_dice.md` con la nuova grammatica delle formule e i limiti aggregati
- [x] 11.2 Aggiornare la documentazione frontend con la selezione cumulativa della tray e la tab Impostazioni; eseguire `npm run docs:check` e verificare che passi
- [x] 11.3 Eseguire `npm test`, `npx tsc -b` e `npx vite build` e verificare che passino tutti
- [x] 11.4 Rileggere i delta sotto `specs/` contro l'implementazione e annotare ogni scostamento residuo prima di considerare il change verificabile — nessuno scostamento residuo: tutte le verifiche manuali sono state confermate a schermo dall'utente (tray, log, scheda, tab); il testo dell'attribuzione (9.4) non è stato riletto separatamente ma la superficie è stata vista
