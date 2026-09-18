## Context

Vedi `proposal.md — Why` per la motivazione e il delta in `specs/character-sheet-management/spec.md` per i requisiti.

Lo stato di partenza che vincola l'approccio:

- `server/character-sheet-schema.mjs` descrive ogni collezione ripetibile in `CHARACTER_COLLECTIONS` come mappa piatta `campo → regola`, dove la regola è la stringa `'text'` oppure l'array dei valori ammessi. La stessa mappa guida valori predefiniti (`defaultRow`), validazione (`validateCollection`), normalizzazione dei documenti letti (`normalizeRow`) e percorsi patch ammessi (`validatePatchOperation`).
- La grammatica dei percorsi patch di una collezione è fissa: `character.<collezione>.<id>.<campo>` con `parts.length === 4`. Non esiste oggi un percorso più profondo dentro una riga, tranne il caso speciale `resources`.
- `validateValueObject` applica lo stesso validatore a tutte le chiavi di un oggetto: `hitDice` e `deathSaves` sono oggi interamente testo libero.
- `#projectOperations` in `server/character-sheet-service.mjs` proietta sul token mappando un percorso patch a un campo del token. `character.initiativeModifier` è una di quelle mappature dirette.
- Il client accumula le patch in una mappa `pendingRef` con chiave per percorso e le invia in blocco con `baseVersion` (`src/hooks/useCharacterSheet.ts`).
- `data_json` è il solo contenitore dei dati variabili della scheda: nessuna colonna relazionale descrive attacchi, strumenti o caratteristiche, quindi nessuna migrazione SQL è necessaria.
- Non esiste oggi codice condiviso fra `server/` (ESM semplice, eseguito da Node senza build) e `src/` (TypeScript compilato da Vite). `tsconfig.app.json` include solo `src` e non abilita `allowJs`.

## Goals / Non-Goals

**Goals:**

- Rendere le regole 5e l'unica fonte dei valori che le regole determinano, in modo che il motore dei tiri della Fase B non debba fidarsi di quello che qualcuno ha digitato in una cella.
- Estendere il modello di attacchi e strumenti restando dentro la grammatica di patch, validazione e normalizzazione già esistente, senza un secondo meccanismo parallelo.
- Convertire i documenti già salvati in sola lettura, senza migrazione SQL, senza passi manuali e senza cambiare un numero sotto gli occhi di chi ha compilato la scheda.

**Non-Goals:**

- Nessuna esecuzione di tiri, nessuna formula inviata al server, nessuna voce di log: sono la Fase B.
- Nessun calcolo per Classe Armatura, velocità, punti ferita e peso dell'equipaggiamento: dipendono da armatura ed equipaggiamento, che la scheda non modella.
- Nessuna validazione semantica delle regole oltre l'aritmetica dichiarata: la scheda non verifica che la classe giustifichi una competenza o che un punteggio sia raggiungibile.
- Nessun cambio della finestra della scheda, delle tab, dei permessi o del ciclo di persistenza.

## Decisions

### Le regole vivono in un modulo condiviso fra server e client

Nuovo `shared/dnd-rules.mjs`, ESM puro senza dipendenze, accompagnato da `shared/dnd-rules.d.ts` e aggiunto a `include` in `tsconfig.app.json`. Contiene le formule del delta spec, la tabella che associa ogni abilità alla propria caratteristica e le funzioni di calcolo di riga, attacco e strumento. Node lo importa da `server/`, Vite da `src/`.

**Perché:** tre consumatori hanno bisogno della stessa aritmetica. Il client deve aggiornare il modificatore mentre l'utente digita il punteggio, senza aspettare una risposta. Il server deve ricalcolare l'iniziativa da proiettare sul token. La Fase B dovrà costruire la formula lato server ignorando quella proposta dal client. Con tre copie, una divergenza silenziosa fra ciò che la scheda mostra e ciò che il dado usa sarebbe questione di tempo.

**Alternative considerate:** calcolo solo sul server con i valori derivati restituiti nella risposta — fonte unica ma latenza a ogni tasto su un campo che alimenta ventiquattro celle; scartata. Modulo in TypeScript sotto `src/` importato dal server — richiederebbe un passo di build per un server che oggi esegue `.mjs` grezzi; scartata. Duplicazione con test di parità fra le due copie — sposta il problema su un test che nessuno aggiorna quando le regole cambiano; scartata.

### I valori derivati escono dal documento

`data_json` conserva solo gli input. Le chiavi rimosse sono `abilities.<k>.modifier`, `proficiencyBonus`, `passivePerception`, `initiativeModifier`, `savingThrows.<k>.value` e `skills.<k>.value`. Il nuovo modello è:

- `abilities.<k>` = `{ score }`, intero, predefinito `'10'`;
- `level` intero, predefinito `'1'`;
- `savingThrows.<k>` = `{ proficient: boolean, miscBonus: string }`;
- `skills.<k>` = `{ proficiency: 'none' | 'proficient' | 'expertise', miscBonus: string }`;
- `initiativeMiscBonus: string` al posto di `initiativeModifier`.

**Perché:** un valore derivato salvato è un valore che può divergere dalla sua fonte. Tenerlo fuori dal documento rende impossibile lo stato incoerente e rende automatica una parte del requisito: i percorsi patch dei valori derivati non esistono più in `validatePatchOperation`, quindi il server rifiuta già ogni tentativo di scriverli senza bisogno di un controllo dedicato.

**Alternativa considerata:** mantenere i campi e ricalcolarli a ogni patch — conserva la forma del documento e introduce esattamente lo stato incoerente che si vuole evitare, perché ogni scrittura diretta o ogni documento letto da una versione precedente li riporterebbe in vita; scartata.

**Conseguenza sul codice:** `validateValueObject` applica un solo validatore a tutte le chiavi di un oggetto. `abilities`, `savingThrows`, `skills`, `hitDice` e `deathSaves` passano a una validazione per chiave con mappa `chiave → regola`.

### Il punteggio parte da 10 e il modificatore non è un campo

Il punteggio è l'unico input della coppia, è validato come intero e vale `10` in una scheda nuova; il modificatore è testo reso, non un `input`.

**Perché:** è la richiesta esplicita, e ha una conseguenza utile — una scheda nuova non ha più caratteristiche «non calcolabili», quindi il caso del segnaposto resta solo dove è inevitabile, cioè su un livello non interpretabile. Rendere il modificatore un campo di sola lettura anziché un `input` disabilitato evita che compaia nella tabulazione e che qualcuno lo riabiliti dagli strumenti del browser aspettandosi che la scrittura funzioni: quel percorso patch non esiste più sul server.

**Nessun tetto al punteggio.** Si valida che sia un intero e nulla di più. Un limite `1..30` bloccherebbe un tavolo con regole proprie in cambio di niente, e la scheda ha sempre accettato l'homebrew sui valori che non contraddicono un'aritmetica.

### Nuova regola `'boolean'` nel vocabolario delle collezioni

Il vocabolario delle regole di campo passa da `'text' | string[]` a `'text' | 'boolean' | 'integer' | string[]`, con impatto su `defaultRow`, `validateCollection`, `normalizeRow` e `setValueError`.

**Perché:** le attivazioni dei blocchi dell'attacco e la sua competenza sono booleane; punteggi e livello sono interi. Entrambi i tipi servono anche fuori dalle collezioni, per il lucchetto e per le caratteristiche, quindi il motore delle regole è il posto giusto in cui insegnarli una volta sola.

### Campi piatti nella riga dell'attacco, non oggetti annidati

L'attacco resta una riga con campi piatti e prefissati: `name`, `attackEnabled`, `attackAbility`, `attackBonus`, `attackProficient`, `range`, `magicBonus`, `critRange`, `damageEnabled`, `damageDice`, `damageAbility`, `damageBonus`, `damageType`, `damageCritDice`, poi gli stessi sei campi del secondo blocco con prefisso `damage2`, infine `saveEnabled`, `saveAbility`, `saveDc`, `saveEffect`, `description`. Lo strumento passa da `modifier` a `bonus` mantenendo `name`, `proficiency`, `ability`.

**Perché:** i campi piatti entrano senza modifiche nella grammatica `character.attacks.<id>.<campo>`, in `defaultRow`, in `validateCollection` e in `normalizeRow`. Una riga con blocchi annidati richiederebbe percorsi patch a cinque segmenti, una validazione ricorsiva e un caso speciale come `resources`, per un guadagno solo estetico.

**Alternative considerate:** blocchi annidati `{ attack: {...}, damage: [{...}, {...}] }` — più fedele al dominio, ma costringe a generalizzare il motore delle patch mentre la Fase B dovrà ancora toccarlo; scartata. Un documento `attackJson` opaco per riga — annulla le patch per campo e il rilevamento dei conflitti di P0.4; scartata.

### Valori chiusi espressi come stringhe

`hitDice.type` ha dominio `['', 'd4', 'd6', 'd8', 'd10', 'd12']`, dove `''` è lo stato «non scelto». `deathSaves.successes` e `deathSaves.failures` hanno dominio `['0', '1', '2', '3']`.

**Perché:** il motore delle regole sa già validare un insieme chiuso, e l'intervallo 0–3 richiesto dal delta spec si ottiene senza un secondo meccanismo.

**Stato iniziale del dado vita:** `''` anziché un dado plausibile come `d8`. Una scheda vuota non ha classe, e inventare un dado significherebbe scrivere un dato che l'utente non ha inserito. Il punteggio di caratteristica è il caso opposto — `10` è il valore neutro delle regole, non un'ipotesi sul personaggio — e per questo lì il predefinito è legittimo. La Fase B tratterà «non scelto» come tiro non disponibile.

### Il lucchetto vive in `character.sectionLocks`

Nuovo oggetto `character.sectionLocks = { attacks: boolean, tools: boolean }`, con percorsi patch dedicati.

**Perché:** il delta spec chiede che il blocco sia un dato della scheda, condiviso fra le finestre autorizzate e persistito. Un oggetto dedicato apre la strada ad altre sezioni senza inventare una convenzione di naming sui campi scalari.

**Alternativa considerata:** stato solo locale del client — il Master e il proprietario vedrebbero stati diversi della stessa scheda e il blocco sparirebbe alla riapertura; contrario al requisito.

### L'editor lavora su una bozza locale e invia le patch alla conferma

L'editor tiene una copia locale dei campi dell'elemento. La conferma emette una patch `set` per ogni campo effettivamente cambiato, passando dalla `patch()` esistente che le accumula in `pendingRef`. L'annullamento scarta la bozza senza emettere nulla. La creazione emette `add` con la riga completa solo alla conferma.

**Perché:** l'annullamento richiesto dal delta spec deve riportare l'elemento allo stato precedente; con patch a ogni tasto servirebbe un undo che oggi non esiste. Il raggruppamento in `pendingRef` è già il comportamento del client, quindi stati di salvataggio, debounce e rilevamento dei conflitti restano quelli di P0.4.

**Trade-off:** un conflitto sullo stesso campo emerge alla conferma e non durante la digitazione. Accettabile: l'editor resta aperto pochi secondi.

**Nota:** questa bozza vale solo per gli editor. Punteggi, competenze e bonus vari restano a patch immediata come il resto della scheda, perché il loro effetto deve essere visibile mentre si digita.

### La proiezione dell'iniziativa sul token passa da mappatura a ricalcolo

`#projectOperations` continua a mappare direttamente nome, punti ferita e velocità. Per l'iniziativa, una patch su un punteggio di Destrezza o su `initiativeMiscBonus` innesca il ricalcolo dal modulo condiviso e la proiezione del risultato.

**Perché:** il valore proiettato non esiste più come campo, quindi non può più essere mappato da un percorso patch. Legare il ricalcolo ai due percorsi che lo influenzano mantiene la proiezione puntuale invece di ricalcolare tutta la scheda a ogni patch.

**Attenzione:** questo è il solo punto in cui un valore derivato esce dalla scheda verso un altro sistema. Se una feature successiva proietterà altri valori calcolati, conviene sostituire la mappatura per percorso con un confronto dei derivati prima e dopo la patch.

### La conversione dei documenti avviene in lettura e conserva i totali

Dentro `normalizeCharacterSheetData`, nell'ordine:

1. **Punteggi.** Se `score` è un intero si tiene. Se `score` manca ma il vecchio `modifier` è un intero, si scrive `score = 10 + 2 × modifier`, il punteggio canonico che produce quel modificatore. Altrimenti `10`.
2. **Livello.** Se `level` è un intero si tiene. Altrimenti, se il vecchio `proficiencyBonus` è un intero, si ricava il livello più basso che lo produce. Altrimenti `1`.
3. **Bonus vari.** Per ogni tiro salvezza, abilità e per l'iniziativa: `miscBonus = vecchio valore − valore calcolato dai nuovi input`. Se il vecchio valore non è un intero, `miscBonus` resta vuoto.
4. **Competenze.** Il booleano delle abilità diventa `'proficient'` o `'none'`.
5. **Attacchi.** `bonus` → `attackBonus` con `attackEnabled` attivo se non vuoto; `damageType` (che nell'interfaccia precedente raccoglieva «danno / tipo» come testo unico) → `damageDice` con `damageEnabled` attivo se non vuoto, lasciando `damageType` vuoto; `notes` → `description`. **Strumenti:** `modifier` → `bonus`.
6. **Dado vita e salvataggi contro morte.** Testo riconoscibile come uno dei cinque dadi, altrimenti `''`; contatore fra `0` e `3`, altrimenti `0`.

**Perché il bonus vari si calcola sui nuovi input e non sui vecchi:** è ciò che rende la garanzia esatta. Il nuovo totale è `nuovo modificatore + nuovo contributo di competenza + miscBonus`, e per costruzione è uguale al vecchio valore qualunque discrepanza ci fosse prima fra livello, bonus di competenza digitato e valore della riga. Chi aveva un'abilità con esperienza, o un bonus di competenza incoerente con il livello, ritrova lo stesso numero: la differenza è semplicemente finita nel bonus vari, dove è visibile e correggibile.

**Perché in lettura:** `normalizeCharacterSheetData` è già il punto in cui il progetto adatta i documenti salvati prima di una riorganizzazione (`adoptLegacyCharacter`) ed è attraversato da ogni lettura. Nessuna migrazione SQL, nessun passo operativo, nessun database a metà conversione.

**Perché il danno legacy finisce tutto in `damageDice`:** il campo precedente mescolava formula e tipo in un testo libero e non è divisibile in modo affidabile. Conservare il testo intero in un campo visibile non perde nulla e lascia la separazione all'utente.

### `clearOperations` riceve i valori predefiniti invece della stringa vuota

L'azzeramento di sviluppo consulta i domini dichiarati e riporta ogni campo al proprio valore predefinito: `''` per il testo, `false` per i booleani, il primo valore del dominio per gli insiemi chiusi, `10` per i punteggi e `1` per il livello.

**Perché:** oggi la funzione scrive `''` su ogni stringa. Con punteggi interi e `deathSaves` vincolato produrrebbe patch che il server rifiuta, rompendo «Svuota scheda» senza un errore chiaro sulla causa.

### I valori da incantatore seguono le stesse regole, al prezzo di un campo tipizzato

`spells.spellcastingAbility` passa da testo libero a caratteristica scelta, con dominio `['', ...sei caratteristiche]` come il campo `ability` degli strumenti. `spells.saveDc` e `spells.attackBonus` escono dal documento e diventano derivati, affiancati da `spells.saveDcMiscBonus` e `spells.attackMiscBonus`.

**Perché due bonus vari e non uno:** un oggetto che potenzia entrambi esiste, ma esistono anche privilegi che toccano solo la CD. Un campo unico costringerebbe a scegliere quale dei due casi supportare; due campi non costano nulla in più nel modello e coprono entrambi.

**Perché il segnaposto quando la caratteristica non è scelta:** a differenza delle abilità, dove la caratteristica è fissata dalle regole, qui la sceglie l'utente. Calcolare `8 + bonus di competenza` senza il modificatore produrrebbe un numero plausibile e sbagliato, che è il tipo di errore peggiore in una scheda usata durante il gioco.

**Conversione.** Il testo esistente viene confrontato con i nomi e le abbreviazioni delle sei caratteristiche. Quando è riconoscibile, i due bonus vari si calcolano per differenza come per le altre righe e i valori visibili restano identici. Quando non lo è, la caratteristica resta non scelta e i due valori mostrano il segnaposto: i numeri precedenti non vengono reinterpretati, perché senza sapere quale caratteristica li ha prodotti qualsiasi ricostruzione sarebbe un'invenzione. È il solo punto in cui la garanzia sui totali identici ammette un'eccezione, ed è dichiarata nel delta spec invece di essere nascosta.

## Risks / Trade-offs

- **La conversione tocca ogni scheda esistente e ogni valore visibile** → i bonus vari sono calcolati per differenza in modo che nessun totale cambi, e un test confronta i totali prima e dopo la conversione su un documento nel formato precedente. È la verifica che precede qualunque riscrittura.
- **Un bonus vari popolato dalla conversione può sembrare un errore all'utente** → è il prezzo dell'identità dei totali. Chi aveva un'abilità con esperienza vedrà il doppio bonus dentro il bonus vari finché non dichiara l'esperienza sulla riga, e a quel punto dovrà azzerare il bonus vari a mano. Vale la pena dirlo nella documentazione della change.
- **Il modulo condiviso è una novità strutturale del progetto** → è un file ESM senza dipendenze con un `.d.ts` accanto, importabile da Node e da Vite senza build. Il rischio è confinato alla configurazione TypeScript, che si verifica con `npm run build`.
- **`exactKeys` rifiuta il documento intero quando una chiave non è prevista** → le chiavi rimosse e quelle aggiunte vanno allineate nella stessa change; un test di schema sul documento iniziale completo fa emergere subito una dimenticanza.
- **La proiezione dell'iniziativa dipende ora da un calcolo** → un test del service verifica che una patch sul punteggio di Destrezza aggiorni il token e che nessun campo di iniziativa venga scritto nella scheda.
- **La caratteristica da incantatore può non essere riconosciuta nella conversione** → CD e bonus di attacco mostrano il segnaposto finché l'utente sceglie la caratteristica, che è un'azione di un click; il delta spec dichiara l'eccezione e un test copre sia il testo riconoscibile sia quello che non lo è.
- **La riga compatta nasconde campi che prima erano visibili** → l'ingranaggio è il solo accesso all'editor e deve essere raggiungibile da tastiera e leggibile dagli screen reader.
- **Il lucchetto può essere scambiato per un permesso** → il delta spec lo dichiara protezione dagli errori e un test di autorizzazione verifica che una sezione sbloccata non apra la scheda a chi non può modificarla.

## Migration Plan

Nessuna migrazione di schema: `npm run db:migrate` non cambia. La conversione avviene alla prima lettura di ogni scheda e viene riscritta in `data_json` alla prima persistenza successiva. Il rollback consiste nel tornare alla versione precedente del codice: le schede già riscritte perderebbero i campi introdotti qui e i valori derivati tornerebbero vuoti, perché la normalizzazione più vecchia non sa ricostruirli dai punteggi. Per questo la verifica sui documenti salvati prima della change — totali identici, nessun dato perso — precede la riscrittura nel nuovo formato.

