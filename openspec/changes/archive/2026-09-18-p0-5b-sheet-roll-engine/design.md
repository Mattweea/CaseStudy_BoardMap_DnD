## Context

Il tiro libero di P0.3 vive interamente in `server/index.mjs`: `parseRollFormula` accetta una stringa `NdS±mod`, `createAuthoritativeRoll` genera i dadi con `randomBytes(4).readUInt32BE(0) % sides + 1`, applica vantaggio/svantaggio tenendo il massimo o il minimo di due `1d20`, e restituisce un oggetto `log` piatto (`formula`, `rolls`, `keptRolls`, `modifier`, `total`, `mode`, `visibility`, autore, timestamp) che `POST /api/battle-map/rolls` inoltra a `appendDiceLog`. Quel formato descrive un solo dado o un solo gruppo di dadi identici con un modificatore: non c'è spazio per un tiro di attacco più due blocchi di danno indipendenti nella stessa voce.

La Fase A di P0.5 (`p0-5a-sheet-action-editors`, presupposta da questa change) ha già anticipato tutti i bersagli come nodi DOM con `data-roll-source="<tipo>:<id>"` — `ability:<key>`, `saving-throw:<key>`, `skill:<key>`, `initiative`, `hit-dice`, `death-saves`, `tool:<id>`, `attack:<id>` — senza collegarli a un gestore di click. Il modulo condiviso `shared/dnd-rules.mjs` espone già ogni funzione di calcolo necessaria (`abilityModifier`, `computeSavingThrowValue`, `computeSkillValue`, `computeInitiative`, `computeToolBonus`, `computeAttackBonus`, `computeDamageModifier`); il modello dell'attacco in `server/character-sheet-schema.mjs` (`CHARACTER_COLLECTIONS.attacks`) espone i campi grezzi (`attackAbility`, `attackBonus`, `attackProficient`, `magicBonus`, `critRange`, i due blocchi di danno, il blocco del tiro salvezza). `CharacterSheetService` espone già `policy.canRead`/`policy.canWrite` e la catena patch/versione/SSE/debounce che questa change deve riusare per gli effetti collaterali.

## Goals / Non-Goals

**Goals:**

- Risolvere un bersaglio della scheda in una o più formule interamente sul server, riusando il generatore già introdotto in P0.3 per ogni dado generato.
- Far tirare due `1d20` indipendenti a ogni bersaglio `1d20`, senza modalità scelta dal client prima del tiro, sul modello di Roll20.
- Tenere il tiro di attacco e il danno dello stesso attacco come bersagli e voci di log separati, con il danno tirabile a richiesta dalla scheda o dal log, senza rompere il formato piatto già consumato dalla tab Chat + Dadi per i tiri semplici.
- Applicare dadi vita rimasti e pallini contro morte come patch della scheda che passano dalla stessa validazione, versione, SSE e persistenza con debounce di P0.4, senza introdurre un secondo canale di scrittura.

**Non-Goals:**

- Sostituire il campionamento con modulo (`% sides`) del generatore: resta quello di P0.3 fino a P0.6, che introduce il campionamento con rifiuto e i test statistici. Questa change riusa il generatore così com'è.
- Il dado 3D e qualunque presentazione fisica del tiro: arrivano con P0.6 e consumano lo stesso risultato autorevole.
- Collegare il risultato dell'iniziativa al tracker di combattimento: arriva con P0.8. Qui il tiro d'iniziativa produce soltanto una voce di log.
- Introdurre nuovi bersagli oltre a quelli già anticipati dalla Fase A: l'elenco è chiuso e verificato dal test esistente `character-sheet-roll-targets.test.mjs`.

## Decisions

### Un solo endpoint di tiro, con una sorgente alternativa alla formula

`POST /api/battle-map/rolls` accetta oggi `{ formula, mode, visibility }`. Questa change aggiunge una forma alternativa del payload, `{ source: { sheetId, target }, visibility?, critical? }`, mutuamente esclusiva con `formula`. `critical` ha senso solo per il bersaglio `attack-damage:<id>` (vedi sotto); è ignorato per ogni altro bersaglio. Il server, quando riceve `source`, non invoca `parseRollFormula` ma un resolver dedicato (`server/character-sheet-roll-resolver.mjs`) che legge lo stato live della scheda (`CharacterSheetService`, la stessa istanza usata dalle route della scheda) e produce la stessa forma di risultato che il generatore avrebbe prodotto per un tiro semplice, tirata due volte per ogni bersaglio `1d20`.

Alternativa scartata: un endpoint separato (`POST /api/battle-map/sheets/:id/rolls`). Duplicherebbe la validazione di `mode`/`visibility`, la generazione del `log.id`/timestamp e l'inoltro ad `appendDiceLog`, con due punti da tenere allineati ogni volta che P0.6 cambia il generatore. Un solo endpoint con due sorgenti mantiene un'unica porta d'ingresso al motore dei tiri, requisito già scritto per P0.6 in `FEATURES_VTT.md` («isolare il motore dei tiri in un modulo con una sola porta d'ingresso»).

### Tiro doppio invece di vantaggio/svantaggio scelto prima del tiro

Roll20, il riferimento diretto per questa fase, non fa scegliere vantaggio o svantaggio prima di tirare: ogni bersaglio la cui formula è `1d20 + modificatore` tira sempre due `1d20` indipendenti nella stessa richiesta e mostra entrambi i totali; è la persona al tavolo a decidere quale dei due contare (il primo per un tiro normale, il maggiore per vantaggio, il minore per svantaggio). Il resolver applica questa regola a caratteristica, tiro salvezza, abilità, iniziativa, strumento, tiro di attacco e salvataggio contro morte — tutti bersagli `1d20` — tirando il gruppo due volte con lo stesso generatore e lo stesso modificatore. Il dado vita non rientra: non è un `1d20` e non ha nozione di vantaggio/svantaggio, quindi resta un tiro singolo. Questo elimina anche la necessità che il client dichiari una modalità prima del tiro.

Alternativa scartata: mantenere la modalità scelta dal client prima del tiro (come nel tiro libero di P0.3) con la modale compatta per la scelta. Costringe a un'interazione in due passi anche per il caso comune (tiro senza vantaggio né svantaggio) e non corrisponde al flusso del riferimento scelto per questa fase.

### Il danno di un attacco è un bersaglio separato dal tiro di attacco

Il tiro di attacco e il danno del medesimo attacco sono due bersagli indipendenti (`attack:<id>` e `attack-damage:<id>`), ciascuno con la propria voce di log, coerentemente con Roll20: il tiro di attacco produce solo i due `1d20`; il danno si tira a parte, dalla riga compatta della scheda o rilanciandolo dalla voce di log del tiro di attacco. Un attacco con due blocchi di danno attivi produce comunque una sola voce di log per il danno, con un campo opzionale `parts: RollPart[]` (uno per blocco) quando i blocchi attivi sono due; con un solo blocco attivo il record usa `formula`/`rolls`/`total` di primo livello come un tiro semplice. Il blocco del tiro salvezza, se attivo, resta metadato dichiarativo (`savingThrow: { ability, dc }`) sulla voce di log del tiro di attacco, non su quella del danno: non è un tiro, ed è il tiro di attacco a determinare se il bersaglio deve tentarlo.

Alternativa scartata (della proposta iniziale): un'unica voce di log con tiro di attacco e danno insieme, generati nella stessa richiesta. Impedirebbe di tirare il danno solo dopo aver deciso a occhio, dai due `1d20`, se il colpo va a segno — che è esattamente il flusso che questa fase riproduce.

### Critico: raddoppio dei dadi, dichiarato dal client sul tiro di danno

Il tiro di attacco dichiara `critical: true` nel proprio log quando almeno uno dei due `1d20` naturali raggiunge `critRange`. Poiché il danno è ora una richiesta separata, il server non può calcolare da sé se quella specifica richiesta di danno segue un colpo critico: il client dichiara `critical` nel payload del tiro di danno, dedotto dall'ultimo tiro di attacco per lo stesso bersaglio nel log condiviso (già sincronizzato via SSE), senza che l'utente lo scelga a mano. Il server si fida di questa dichiarazione come già si fida di modalità e modificatore temporaneo nel tiro libero di P0.3: non è un risultato proposto dal client, è un'istruzione su quale variante del tiro eseguire. Quando `critical` è `true`, il resolver raddoppia il numero di dadi di ciascun blocco di danno attivo prima di generarli (`count * 2`), lasciando il modificatore invariato, coerente con la regola 5e. La voce di log del danno porta `critical: true`.

### Autorizzazione riusa `canRead`, effetti collaterali riusano il flusso di patch esistente

Il resolver richiede la scheda con `CharacterSheetService` usando la stessa istanza e lo stesso `policy.canRead(user, record)` già verificato dalle route di lettura della scheda: chi non può leggere la scheda non può tirarne i bersagli, indipendentemente da chi possiede il token associato. Dadi vita rimasti e pallini contro morte non vengono scritti da un percorso nuovo: dopo aver generato il tiro, il server costruisce una patch (`set` su `character.hitDice.remaining` o su `character.deathSaves.successes`/`failures`) con `baseVersion` uguale alla versione live corrente e la passa alla stessa funzione di applicazione patch usata dalle richieste del client, così che validazione di dominio, incremento di versione, distribuzione SSE e persistenza con debounce restino un solo percorso di codice. Se il documento risultante non è valido (per esempio contatore già a 3), la patch viene respinta e il tiro non viene eseguito.

### Un solo click, nessuna modale prima del tiro

Con il vantaggio/svantaggio sostituito dal tiro doppio (vedi sopra) e la visibilità non ancora affrontata da questa fase, non resta alcuna scelta da raccogliere prima del tiro: il click esegue subito la richiesta, sempre pubblica. Non c'è più un'interazione secondaria sui bersagli della scheda; la modale compatta di P0.3 resta quella del tiro libero, non riusata qui. Una scelta esplicita di visibilità per i tiri della scheda resta da progettare in una fase successiva.

## Risks / Trade-offs

- [Il formato di log composito (`parts`) introduce un ramo in più nel renderer del log] → il campo è opzionale e additivo; i tiri semplici (sei bersagli su otto) non lo popolano e restano indistinguibili dal formato di oggi.
- [Costruire una patch lato server per gli effetti collaterali duplica, nel resolver, la conoscenza di quali percorsi sono scrivibili] → il resolver non introduce un proprio elenco di percorsi: chiama la stessa funzione di validazione di `server/character-sheet-schema.mjs` già usata per le patch del client, quindi un dominio stretto in un punto solo.
- [Un tiro composito che generi la patch dell'effetto collaterale ma fallisca nell'invio del log lascerebbe uno stato incoerente] → la patch viene applicata prima di rispondere con il log e nello stesso percorso sincrono di `createAuthoritativeRoll`/`appendDiceLog`; un fallimento della patch interrompe la richiesta con un errore prima che qualunque voce raggiunga il log, così i due passi restano atomici dal punto di vista del client.
- [Il generatore con modulo bias resta in uso anche per i tiri della scheda] → è un rischio già accettato e documentato per P0.6; riusare lo stesso generatore invece di introdurne uno diverso per i tiri della scheda evita che P0.6 debba correggere due implementazioni.

## Migration Plan

Nessuna migrazione dati: la capability non introduce nuovi campi persistiti oltre a quelli già presenti dopo la Fase A (`hitDice.remaining`, `deathSaves.successes/failures`). Il rollout è un deploy ordinario del server e del client; un client aggiornato che parli con un server non ancora aggiornato riceverebbe un `404`/`400` sul payload `source` e può continuare a offrire soltanto il tiro libero fino al deploy del server. Nessun rollback speciale: disattivare i gestori di click lato client riporta al comportamento della Fase A senza toccare i dati.
