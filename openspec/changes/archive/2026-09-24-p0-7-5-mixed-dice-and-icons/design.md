## Context

Motivazione in `proposal.md - Why`. Requisiti osservabili nei delta sotto `specs/`.

Tre vincoli del codice attuale determinano l'approccio.

**Il motore aggrega solo il primo gruppo.** `resolveDiceRoll` in `shared/dice-engine.mjs` risolve correttamente tutti i gruppi e restituisce `groups` e `dice` completi, ma i campi di riepilogo `formula`, `rolls`, `keptRolls`, `modifier` e `total` sono copiati da `resolvedGroups[0]`. Un chiamante che passa più gruppi e legge `total` ottiene il totale del primo, non del tiro.

**Esiste già un precedente per i tiri multi-gruppo.** `server/character-sheet-roll-resolver.mjs` risolve i danni con più gruppi e pubblica `log.parts`, un array con `label`, `formula`, `rolls`, `keptRolls`, `modifier`, `total` per ogni gruppo, lasciando i campi legacy del log a rappresentare il primo. `DiceLogEntry` rende quel caso con un riquadro per parte. Il tiro libero non passa da quel ramo: cade nell'ultimo ramo del componente, che deduce un unico tipo di dado con `diceSidesFromFormula(log.formula)` e somma `log.keptRolls`.

**Il motore non conosce gruppi negativi.** `normalizeGroup` pretende `count` intero `>= 1` e non ha un campo di segno.

**Il log ha due affordance diverse per lo stesso dato.** `DiceLogEntry` si dirama su `sourceKind`. Il tiro libero rende un `article` con la formula visibile e un dettaglio che si apre al click sul totale. I tre rami della scheda — `dual`, `damage`, `single` — passano da `PairCard`, che non mostra la formula e affida il dettaglio all'attributo `title` dei riquadri, cioè al tooltip nativo del browser: visibile solo col puntatore e mai da tastiera. Il commento sopra `PairCard` dichiara «mai la formula in chiaro» come scelta deliberata; questo change la ribalta.

## Goals / Non-Goals

**Goals:**

- Un solo contratto di risultato per il tiro libero multi-gruppo, riusando `parts` invece di introdurre una forma parallela.
- Mantenere il server l'unica autorità su validazione, esiti e totale.
- Lasciare invariati i log già registrati e il ramo di danno della scheda.

**Non-Goals:**

- Cambiare quali risultati un tiro produce. L'unificazione riguarda la resa della voce di log, non il numero di `1d20` di un bersaglio né la suddivisione in gruppi di un danno.
- Riallineare il tiro di danno della scheda, dove `log.total` rappresenta il primo gruppo e la UI mostra riquadri separati per tipo di danno. È una incoerenza reale fra i due rami, ma toccarla cambierebbe la lettura dei danni per tipo, che è voluta.
- Un linguaggio di formule generale: niente parentesi, moltiplicazioni, `kh`/`kl`, tiri annidati o dadi esplosivi.
- Estendere vantaggio e svantaggio oltre `1d20` puro.
- Ridisegnare la presentazione 3D: i gruppi logici sono già previsti da `dice-3d-presentation`, e l'unica modifica a quella capability è la rimozione della resa differenziata fra tenuti e scartati.
- Il tiro d'iniziativa doppio. `initiative-presentation` assegna già a P0.8 la scelta normale/vantaggio/svantaggio per l'iniziativa, e il valore d'iniziativa deve collassare a un numero solo per guidare l'ordine dei turni, cosa che un `d20` nel log non deve fare. Il tiro di massa per tutte le creature moltiplicherebbe inoltre quel momento di risoluzione. La decisione è presa — l'iniziativa diventerà doppia come ogni altro `d20` — ma il lavoro appartiene a P0.8, e `initiativeMode` sui token resta vestigiale fino ad allora.

## Decisions

### Parser a termini, non regex unica

`parseRollFormula` diventa una scansione di termini: normalizzazione degli spazi, split sui segni conservando il segno di ciascun termine, classificazione di ogni termine come gruppo `NdS` o come intero. Il risultato è una lista di gruppi con segno più un modificatore complessivo.

*Alternativa considerata*: estendere la regex con un gruppo ripetuto. Scartata perché una regex che accetta termini firmati ripetuti smette di poter dire **quale** termine è invalido, e il requisito chiede un errore che indichi la regola violata.

### Totale aggregato esposto dal motore, non calcolato dai chiamanti

`resolveDiceRoll` guadagna un totale che somma i gruppi rispettandone il segno, accanto ai campi legacy che restano invariati per non rompere i chiamanti esistenti. Il totale aggregato è un campo nuovo: i campi legacy continuano a descrivere il primo gruppo.

*Alternativa considerata*: sommare nel server, in `createAuthoritativeRoll`. Scartata perché metterebbe la regola di somma fuori dal motore che possiede il modello probabilistico, e il resolver della scheda finirebbe per riscrivere la stessa somma in modo indipendente.

*Alternativa considerata*: cambiare il significato di `total` in aggregato. Scartata perché `character-sheet-roll-resolver` legge `resolved.rolls` per dedurre il critico e costruisce il log dai campi del primo gruppo: cambiarli sotto di lui romperebbe il critico senza un errore di tipo.

### Segno del gruppo come campo del gruppo

Il gruppo normalizzato acquisisce un segno esplicito, con `count` che resta `>= 1`. Il segno entra nel totale del gruppo e nel totale aggregato; i singoli dadi conservano il valore della faccia, mai negativo, come richiede il delta.

*Alternativa considerata*: `count` negativo. Scartata perché sfonda ogni invariante che conta i dadi, a partire dal limite complessivo e dalla generazione degli identificatori.

### Il tiro libero pubblica `parts` quando i gruppi sono più di uno

Il log del tiro libero riusa la forma `parts` già consumata da `DiceLogEntry`. Il ramo del tiro libero del componente deve però distinguere due casi: con `parts` assenti mantiene il rendering attuale a dado singolo, con `parts` presenti mostra il dettaglio per gruppo e il totale aggregato. `diceSidesFromFormula` resta usata solo nel primo caso.

*Alternativa considerata*: riusare il ramo `damage`. Scartata perché quel ramo mostra un riquadro per parte senza totale complessivo, che per un tiro di danno per tipo è corretto e per un tiro libero è la domanda sbagliata.

### Una card sola, con i totali come comandi

I quattro rami di `DiceLogEntry` convergono su una card unica: intestazione, formula, uno o più totali attivabili, un dettaglio condiviso e, quando il tiro viene dalla scheda, l'azione d'origine. Il numero di totali resta l'unica variabile fra le origini.

Il tooltip `title` sparisce come veicolo del dettaglio. Non è una perdita: un tooltip nativo non è raggiungibile da tastiera e non è annunciato in modo affidabile, quindi oggi il dettaglio di un tiro dalla scheda è di fatto indisponibile a chi non usa il mouse. Sostituirlo con un comando che espande la card rende quel dato accessibile per la prima volta.

*Alternativa considerata*: tenere il tooltip e aggiungere l'espansione. Scartata perché lascerebbe due strade allo stesso dato, che è esattamente il difetto da togliere.

### Più totali, un dettaglio solo

Una voce con più risultati espone un comando per totale, affiancati come oggi in `PairCard`, e un unico dettaglio che li comprende. Attivare un totale qualsiasi apre lo stesso dettaglio.

*Alternativa considerata*: una card per risultato. Scartata perché spezzerebbe visivamente la coppia di `1d20`, che in 5e si legge insieme, e raddoppierebbe l'ingombro del log.

*Alternativa considerata*: un totale solo, con gli altri nel dettaglio. Scartata perché per un bersaglio `1d20` doppio sceglierebbe di fatto quale dei due è il risultato principale — proprio la scelta che il server evita di fare per il giocatore, per requisito di `character-sheet-roll-actions`.

### Icone del log prese dalla stessa sorgente della tray

Il dettaglio continua a usare il componente `DiceGlyph` già usato dalla tray, invece di un insieme di tracciati separato. La coerenza diventa una proprietà strutturale e non una cosa da ricordarsi di allineare: la sostituzione del set di icone tocca un punto solo e arriva in entrambe le superfici.

### Tab su una riga a ingombro ridotto

Le tab sono già pulsanti di sola icona. Con la quinta la riga può andare a capo alle larghezze strette del pannello. La riga singola si ottiene riducendo l'ingombro dei pulsanti, non abilitando il ritorno a capo: l'etichetta testuale è già affidata a `title` e `aria-label`, quindi ridurre il pulsante non toglie informazione.

### Il d20 fuori dalle formule miste

Un `1d20` produce due esiti e il lettore ne sceglie uno. In una formula mista il totale complessivo dovrebbe allora dire quale dei due somma, e qualunque risposta sarebbe una scelta fatta al posto del giocatore — proprio ciò che il modello evita. Il `d20` si tira quindi da solo, e il parser rifiuta una formula che lo mescola ad altri gruppi.

*Alternativa considerata*: due esiti per il `d20` e nessun totale complessivo nelle formule miste. Scartata perché toglierebbe il numero unico in fondo alla card proprio al caso che lo richiede di più.

*Alternativa considerata*: ammettere `1d20+5 + 6d4` sommando il primo esito. Scartata perché sceglie in silenzio, e la scelta silenziosa del server è l'errore che `character-sheet-roll-actions` evita deliberatamente.

Conseguenza da accettare: attacco e danno restano due tiri distinti anche dal tray, come già sono dalla scheda.

### La modalità sparisce dal client, non dal motore

Il tiro libero smette di dichiarare `mode`: un solo `d20` si risolve come `unresolved`, gli altri gruppi come `normal`. Il server rifiuta una modalità dichiarata dal client per il tiro libero.

`advantage` e `disadvantage` restano però nel motore: `InitiativeRollModal` li usa per i token con `initiativeMode: 'advantage'`. Non sono codice morto, e rimuoverli romperebbe l'iniziativa.

Ne segue che `disposition: 'discarded'` perde il suo unico produttore, perché quel percorso dell'iniziativa calcola un numero lato client senza creare una voce di log. Il requisito di `dice-3d-presentation` che chiede di attenuare i dadi scartati viene quindi rimosso invece di restare vero soltanto per le voci storiche: una specifica che descrive un comportamento non più generabile inganna chi la legge.

Il campo `disposition` resta però nel dato. Le voci storiche con vantaggio continuano a portarlo, e le si presenta con pari enfasi solo perché la resa smette di distinguerlo — non perché l'informazione sia andata persa. Ripristinare la distinzione in futuro non richiederebbe alcuna migrazione.

### Coppia e indipendenti: nessun marcatore, la formula basta

`1d20` e `2d20` mostrano entrambi due totali con significati opposti: nel primo caso sono alternative fra cui scegliere (il primo per un tiro normale, il maggiore per vantaggio, il minore per svantaggio), nel secondo due risultati che valgono entrambi. Il dato per distinguerli esiste — il primo passa da `unresolved`, il secondo da `normal`, e le disposizioni dei dadi lo registrano — ma la card non lo rende con un'etichetta: la formula visibile sulla voce (`1d20` contro `2d20`) già dice quale caso sia, e chi tira conosce la convenzione a memoria. Un marcatore testuale ripeterebbe un'informazione che il giocatore non ha chiesto.

*Alternativa considerata*: marcare esplicitamente la coppia con una didascalia. Scartata su richiesta esplicita: il giocatore lo sa già, e un'etichetta in più è rumore, non chiarezza.

*Alternativa considerata*: vietare `Xd20` con `X` maggiore di uno. Scartata su scelta esplicita: nessuna regola lo richiede.

### Visibilità: un interruttore per la scheda, un comando per il tray

La scheda guadagna un interruttore in testa che vale per i tiri fatti da lì; il tray conserva i pulsanti nella modale e guadagna `/rs`. Le due superfici restano separate: un interruttore sulla scheda che governasse anche il tray creerebbe due padroni per la stessa proprietà nella modale, senza un ordine di precedenza evidente.

Il rischio dell'interruttore appiccicoso è asimmetrico. Tirare segreto credendosi pubblici è un fastidio; tirare pubblico credendosi segreti rivela qualcosa che non si può più ritirare. Per questo il requisito chiede che lo stato sia indicato **dove si tira**, non solo dove si cambia: il bersaglio del tiro sulla scheda deve dire che il prossimo tiro sarà segreto.

### L'interruttore della scheda persiste, con ambito la singola scheda

L'interruttore sopravvive alle ricariche. L'ambito assunto è la singola scheda, coerentemente con la sua collocazione: chi possiede più schede le tratta separatamente. Come le preferenze di presentazione dei dadi, lo stato resta locale al browser e non entra nello stato condiviso, perché è una preferenza di chi tira e non un fatto della sessione.

Proprio perché persiste, l'indicazione sul bersaglio del tiro smette di essere un ornamento: uno stato che sopravvive a una ricarica può essere stato attivato in una sessione precedente e dimenticato.

### Limiti aggregati, non per gruppo

Il limite di dadi diventa esplicitamente complessivo e conta i dadi **generati**, non quelli scritti nella formula: un `1d20` ne produce due. Confondere i due conteggi farebbe sforare `MAX_PRESENTATION_DICE` restando dentro il limite dichiarato. Si aggiungono un tetto al numero di gruppi e un tetto al valore assoluto del modificatore complessivo.

*Alternativa considerata*: applicare i limiti attuali per gruppo. Scartata perché venti gruppi da venti dadi passerebbero ogni controllo locale e produrrebbero quattrocento dadi, ben oltre `MAX_PRESENTATION_DICE`.

### Tray a selezione cumulativa

La tray del pannello smette di azzerare gli altri tipi quando si cambia dado. La formula si compone ordinando i tipi per numero di facce e concatenando i gruppi con `+`, più il modificatore in coda. Il riepilogo sopra il pulsante mostra la formula composta invece di `NdS`.

Il commit `c936485` aveva introdotto l'azzeramento proprio perché il server accettava un gruppo solo e i contatori residui mentivano: questo change ne rimuove la causa, quindi quella guardia va tolta, non aggirata.

### Icone da game-icons.net inlineate, non un font

Gli SVG del set vengono inlineati come gli attuali, conservando `viewBox`, `currentColor` e le props del componente. Il set è a riempimento pieno mentre i disegni attuali sono a tratto: l'adeguamento di peso e contrasto sul tema scuro è lavoro reale, non una sostituzione di tracciati.

`d100` non esiste nel set e resta composto, coerentemente con la rappresentazione percentile già specificata in `dice-3d-presentation`.

*Alternativa considerata*: RPG Awesome come icon font. Scartata su scelta esplicita per non servire un font e non perdere il controllo per icona.

### Attribuzione nella tab Impostazioni

CC BY 3.0 richiede credito all'autore e indicazione della licenza. La tab Impostazioni è la superficie stabile più adatta: esiste già, non dipende dal ruolo e non è legata allo stato della sessione.

## Risks / Trade-offs

**Il totale aggregato affiancato ai campi legacy lascia due verità nello stesso oggetto** → I campi legacy restano definiti come "primo gruppo" nei tipi e nel commento del motore; i test coprono esplicitamente un tiro multi-gruppo in cui i due valori differiscono, così una futura confusione fallisce invece di passare.

**Il limite complessivo di dadi può superare `MAX_PRESENTATION_DICE`** → Il tetto complessivo va scelto coerente con il limite di presentazione; oltre quel punto la presentazione 3D degrada già al log numerico per requisito esistente. Da verificare esplicitamente, non da assumere.

**La tray cumulativa può produrre formule lunghe** → Il tetto sul numero di gruppi limita la lunghezza; il riepilogo del pannello deve restare leggibile con il massimo consentito, non solo con due gruppi.

**Il set di icone cambia il peso visivo di tutta la tray** → Icone piene su fondo scuro rendono diversamente dai tratti attuali; la sostituzione va valutata a schermo prima di considerarla conclusa, perché nessun test automatico la copre.

**L'attribuzione è un obbligo di licenza, non una preferenza** → Se l'adozione delle icone viene rimandata, va rimandata anche la riga di attribuzione; se le icone entrano, l'attribuzione entra nello stesso cambiamento, mai dopo.

**L'unificazione tocca i tiri della scheda, governati da un'altra capability** → `character-sheet-roll-actions` richiede già che le voci di log usino «lo stesso formato» del tiro libero, quindi l'unificazione avvicina il codice a quel requisito invece di contraddirlo. Nessun requisito di quella capability impone il tooltip né vieta la formula: la restrizione vive solo nel codice. Se durante l'implementazione emerge un requisito che invece la impone, va sollevato prima di procedere, non aggirato.

**La coppia di `1d20` potrebbe sembrare un errore con la formula visibile** → La formula è `1d20 + modificatore` mentre i totali sono due: chi legge può crederlo un difetto. Il marcatore della coppia serve anche a questo, oltre che a distinguerla da `2d20`.

**Vietare il `d20` nelle formule miste rifiuta un caso che sembrava supportato** → `1d20+5 + 6d4` era l'esempio di partenza della richiesta e ora viene respinto. L'errore deve spiegare il perché e non limitarsi a dire che la formula non è valida, altrimenti sembra un limite arbitrario del parser.

**Il tiro segreto dalla scheda è un requisito già dichiarato e mai soddisfatto** → Va trattato come un difetto che si chiude, non come una funzione nuova: il server e i tipi lo supportano già, manca solo il controllo nell'interfaccia.

**La deriva sulle tab viene sanata in un change che parla di dadi** → Il collegamento è la tab Impostazioni, che ospita le preferenze dei dadi. Se il change venisse abbandonato, la deriva resterebbe: va ripresa a parte in quel caso.

## Migration Plan

Nessuna migrazione di dati. Il campo `formula` è testuale e i log storici restano validi per costruzione: un tiro a gruppo singolo è un caso particolare della nuova grammatica e continua a non produrre `parts`.

Il rollback è la revoca del change: le formule multi-gruppo già registrate resterebbero nel log e verrebbero rese dal ramo a dado singolo, che dedurrebbe un tipo di dado sbagliato dalla formula. Se il rollback diventa concreto, va accompagnato da una decisione esplicita su quelle voci.

## Open Questions

- Il valore esatto del tetto complessivo di dadi e del tetto sul numero di gruppi, da fissare in implementazione confrontandoli con `MAX_PRESENTATION_DICE` e con la leggibilità della scena.
- Se il riepilogo del tiro libero multi-gruppo debba mostrare anche i subtotali per gruppo oltre al totale, decidibile guardando il componente a schermo senza toccare i requisiti.
- Il rapporto tipografico esatto fra formula e totale, e di quanto ridurre i pulsanti delle tab: entrambi si fissano a schermo e nessuno dei due cambia i requisiti.
