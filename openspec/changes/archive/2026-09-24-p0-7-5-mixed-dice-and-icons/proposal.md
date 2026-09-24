## Why

Il server accetta un solo gruppo `NdS` per tiro: `parseRollFormula` ancora la formula a `^(\d{1,2})d(4|6|8|10|12|20|100)([+-]\d{1,4})?$`. In D&D 5e i danni misti sono ordinari — attacco furtivo `1d8 + 3d6`, Divine Smite `1d8 + 2d8`, Hex che aggiunge `1d6` al danno dell'arma, armi elementali — e oggi richiedono due tiri separati, che spezzano il log, la presentazione 3D e la lettura del totale.

Il motore condiviso `resolveDiceRoll({ groups })` accetta già un array di gruppi e la presentazione 3D copre già lo scenario "Danno con più gruppi", ma l'aggregazione è parziale: i campi di riepilogo del risultato descrivono soltanto il primo gruppo. Il tiro di danno della scheda convive con questo limite pubblicando un array `parts`. Il tiro libero non ha una via equivalente, e il parser del server e la tray del pannello restano fermi a un tipo di dado.

## What Changes

- La formula accettata dal server diventa una somma di termini: gruppi `NdS` e modificatori interi, separati da `+` o `-`, con spazi ignorati. `1d8 + 3d6`, `2d6+1d8-2` e `1d8 - 1d4` diventano validi.
- **BREAKING**: una formula che contiene un `d20` SHALL NOT contenerne altri gruppi di dado. Il `d20` si tira da solo, perché è l'unico dado che porta la semantica della coppia e mescolarlo ad altri gruppi renderebbe ambiguo quale dei due esiti entra nel totale.
- Un termine `NdS` preceduto da `-` sottrae il proprio subtotale, senza produrre dadi con valori negativi.
- La tray del pannello di lancio accumula più tipi di dado in una sola selezione, al posto dell'attuale azzeramento quando si cambia tipo.
- I limiti di validazione passano da "per tiro" a una forma esplicita su più gruppi: numero massimo di dadi complessivo, numero massimo di gruppi e somma dei modificatori.
- **Il `d20` smette di avere una modalità scelta prima del tiro.** Un `1d20` genera sempre due esiti indipendenti e chi legge sceglie quale contare, come già fanno i bersagli della scheda. Il selettore Normale/Vantaggio/Svantaggio sparisce dalla modale: non c'è più niente da scegliere prima. `Xd20` con `X` maggiore di uno resta ammesso e produce altrettanti esiti indipendenti, senza semantica di coppia.
- `1d20` e `2d20` mostrano entrambi due totali senza un marcatore che li distingua: chi legge il log conosce già la convenzione (il primo per un tiro normale, il maggiore per vantaggio, il minore per svantaggio) e non ha bisogno che la card la ripeta.
- **Il tiro segreto diventa raggiungibile da ogni superficie.** La scheda guadagna un interruttore in alto, accanto ai comandi di salvataggio, che vale per i tiri fatti da quella scheda; il tray guadagna il comando `/rs` con la stessa grammatica di `/r`. Oggi `character-sheet-roll-actions` richiede il tiro segreto dalla scheda, ma nessun componente invia quel campo: il requisito è dichiarato e non soddisfatto.
- L'interruttore della scheda persiste fra le ricariche. Uno stato che persiste fra un tiro e il successivo deve essere visibile **dove si tira**, non solo dove si cambia: credersi in segreto e tirare in pubblico rivela qualcosa che non si può più nascondere.
- `disposition: 'discarded'` smette di essere producibile e la presentazione 3D smette di attenuare i dadi scartati. Il campo resta nel dato delle voci storiche, quindi la distinzione è ripristinabile in futuro senza migrazione.
- Le icone dei dadi passano dagli SVG disegnati a mano al set poliedrico di game-icons.net, che copre `d4`-`d20`; il `d100` resta composto. La licenza CC BY 3.0 impone una attribuzione visibile nel prodotto.
- **Unificazione della card del log.** Oggi il dettaglio dei dadi si raggiunge in due modi diversi a seconda dell'origine del tiro: il tiro libero espande una sezione al click sul totale, il tiro dalla scheda mostra il dettaglio soltanto come tooltip nativo in hover. Il tooltip sparisce: ogni voce di log usa la stessa card, con il dettaglio che si apre al click.
- La formula diventa visibile su ogni voce, con un peso tipografico ridotto rispetto al totale, che resta l'elemento dominante. Un tiro originato dalla scheda aggiunge soltanto l'azione che lo ha prodotto, per esempio «Danno — Spada corta».
- Una voce con più risultati — i due `1d20` indipendenti della scheda, o i gruppi di un danno misto — espone un pulsante per ciascun totale e un unico dettaglio che li comprende tutti.
- Le icone dei dadi mostrate nel dettaglio SHALL essere le stesse usate nella tray di lancio, così che lo stesso dado non abbia due rappresentazioni nella stessa schermata.
- Le tab del pannello destro restano su una sola riga anche a cinque tab, riducendone l'ingombro invece di mandarle a capo.
- **Allineamento di una deriva esistente**: il pannello destro espone cinque tab da `029d6ca`, mentre `session-workspace` ne dichiara quattro. Il requisito viene aggiornato per includere Impostazioni, che ospita le preferenze di presentazione dei dadi.

Nessuna modifica è retroattiva sui log già registrati: le voci esistenti restano a gruppo singolo e continuano a leggersi con lo stesso formato.

## Capabilities

### New Capabilities

Nessuna capability nuova: il cambiamento estende comportamenti già governati da capability esistenti.

### Modified Capabilities

- `session-dice-rolling`: la formula valida passa da un gruppo singolo a una somma di più gruppi e modificatori, con il `d20` escluso dalle formule miste; i controlli a click permettono di comporre più tipi di dado; il `d20` produce sempre una coppia e la modalità dichiarata dal client sparisce; ogni superficie di tiro offre la scelta della visibilità e la rende evidente quando è uno stato persistente; il log adotta una card unica con dettaglio al click, indipendente dall'origine del tiro.
- `dice-3d-presentation`: la resa differenziata fra dadi tenuti e scartati viene rimossa, perché `discarded` perde ogni produttore quando il tiro libero smette di dichiarare una modalità; i dadi di una voce sono presentati con pari enfasi e le voci storiche restano leggibili.
- `session-workspace`: il requisito sulle tab del pannello destro passa da quattro a cinque, nomina la tab Impostazioni e impone che restino su una sola riga; il prodotto espone l'attribuzione richiesta dalla licenza del set di icone.

## Impact

**Backend**

- `server/authoritative-roll.mjs`: `parseRollFormula` passa da una regex monolitica a un parser di termini; `createAuthoritativeRoll` passa più gruppi a `resolveDiceRoll`, applica i limiti aggregati, rifiuta il `d20` in una formula mista e smette di accettare `mode` dal client per il tiro libero, risolvendo un solo `d20` come `unresolved`.
- `server/character-sheet-roll-resolver.mjs`: il log di un danno a più blocchi espone oggi `formula: rolledParts[0].formula`, cioè il solo primo blocco. Con la formula visibile sulla card, quel valore va composto da tutte le parti.

**Shared**

- `shared/dice-engine.mjs`: `resolveDiceRoll` accetta già `groups` ma ricava `formula`, `rolls`, `keptRolls`, `modifier` e `total` dal solo primo gruppo, quindi serve un totale aggregato per il tiro libero. `normalizeGroup` impone inoltre `count >= 1` e non conosce il segno del gruppo: la sottrazione di un gruppo richiede un concetto nuovo nel motore, non è gratuita.
- `shared/dice-3d-presentation.mjs`: la notazione per il renderer è già costruita per tipo (`diceByType`); da verificare il superamento di `MAX_PRESENTATION_DICE` con più gruppi.

**Frontend**

- `src/components/DicePanel.tsx`: la tray accumula più tipi; la formula si compone dai contatori; il selettore di modalità sparisce dalla modale; il comando riconosce `/rs` oltre a `/r`.
- `src/components/character-sheet/`: interruttore di visibilità in testa alla scheda e propagazione del campo `visibility`, oggi mai inviato, nelle chiamate di tiro.
- `src/components/DiceLogEntry.tsx`: convergenza dei quattro rami di rendering su una card sola, con il marcatore che distingue una coppia dagli esiti indipendenti e la didascalia che non ricade più su `log.label`, che per un tiro libero è la formula e verrebbe ripetuta. `PairCard` perde il tooltip `title` come unico veicolo del dettaglio e guadagna l'espansione al click; il ramo del tiro libero deduce oggi un unico tipo di dado dalla formula (`diceSidesFromFormula`) e somma `keptRolls`, e con più gruppi entrambe le assunzioni cadono. Il commento che oggi dichiara «mai la formula in chiaro» per le card della scheda descrive una decisione che questo change ribalta.
- `src/styles/index.css`: stile della card unificata, peso della formula, e tab del pannello destro su una riga sola a cinque voci.
- `src/components/DiceIcons.tsx`: sostituzione dei tracciati SVG e conseguente adeguamento di tratto, dimensione e tema.
- Superficie di attribuzione per CC BY 3.0, da collocare in una tab del pannello destro.

**Contratto e persistenza**

- Il campo `formula` dei log accoglie stringhe più lunghe e composite. Nessuna migrazione SQLite prevista: il campo è testuale e i log storici restano validi.

**Documentazione**

- `Docs/ai/gameplay/combat_movement_and_dice.md` e i router applicabili; `npm run docs:check` da eseguire quando la documentazione cambia.
