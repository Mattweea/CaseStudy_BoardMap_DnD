## Why

Lanciare un tiro dalla scheda è l'azione più frequente della sessione (P0.5 in `FEATURES_VTT.md`). Il motore dei tiri della Fase B leggerà `1d20 + valore della cella`: se quella cella è un testo libero scritto a mano, il motore eredita gli errori di chi compila e la correttezza del risultato dipende dall'attenzione del giocatore invece che dalle regole. P0.4 aveva scelto la compilazione interamente manuale; quella scelta non regge sotto un motore di tiri.

In parallelo, attacchi e strumenti sono oggi righe di input affiancati: ogni campo è un bersaglio di modifica e nessun elemento è un bersaglio di click, quindi un tiro non avrebbe dove agganciarsi senza rischiare di alterare un valore mentre si gioca.

Questa change copre la Fase A di P0.5: le regole di calcolo e la presentazione delle azioni. L'esecuzione dei tiri, il log e gli effetti collaterali dei tiri restano alla Fase B.

## What Changes

**Regole 5e calcolate**

- **BREAKING** I valori che le regole determinano escono dal documento della scheda e diventano di sola lettura: modificatore di caratteristica, bonus di competenza, valore dei tiri salvezza, valore delle abilità, Percezione passiva e iniziativa. Restano dati soltanto gli input: punteggi, livello, competenze dichiarate e bonus vari.
- Il modificatore di caratteristica è la parte intera inferiore di `(punteggio − 10) ÷ 2`. Il punteggio è l'unico campo modificabile della coppia, è un intero e vale `10` in una scheda nuova. Il modificatore non è scrivibile né dall'interfaccia né dalle API: la regola non è aggirabile.
- Il bonus di competenza è `2 + parte intera inferiore di ((livello − 1) ÷ 4)`. Il livello è un intero e vale `1` in una scheda nuova.
- **BREAKING** La competenza di un'abilità passa da booleana a tre livelli — nessuna, competente, esperto — come già avviene per gli strumenti. L'indicatore della riga cicla fra i tre a click successivi.
- Ogni tiro salvezza, ogni abilità e l'iniziativa ricevono un campo **bonus vari**, vuoto per default, che si somma al calcolo. È la via d'uscita per oggetti magici e regole della casa, al posto della riscrittura del totale.
- **BREAKING** Nella tab Incantesimi la caratteristica da incantatore passa da testo libero a caratteristica scelta, e CD del tiro salvezza e bonus di attacco da incantatore diventano calcolati: `8 + bonus di competenza + modificatore` il primo, `bonus di competenza + modificatore` il secondo, ciascuno con il proprio bonus vari.
- Restano manuali Classe Armatura, velocità, punti ferita e peso dell'equipaggiamento: dipendono da armatura ed equipaggiamento, che la scheda non modella ancora.

**Azioni della scheda**

- **BREAKING** Il modello dell'attacco in `data_json` passa da `{ name, bonus, damageType, notes }` a un insieme di campi che descrivono tiro di attacco, gittata, bonus magico, soglia di critico, due blocchi di danno, tiro salvezza e descrizione.
- Gli attacchi si aggiungono e si modificano in un **editor dedicato**; alla conferma l'attacco compare come **riga compatta** con nome, bonus di attacco e danno/tipo, riapribile dall'icona a ingranaggio. **Strumenti e competenze** adotta lo stesso modello.
- Entrambe le sezioni ottengono un **lucchetto** che blocca aggiunta, modifica e rimozione lasciando la lettura. È un dato della scheda, non un permesso.
- Il riquadro **Dadi vita** mostra il totale in alto e i rimasti in basso, con il tipo di dado vincolato a `d4`–`d12` più lo stato «non scelto». I **tiri salvezza contro morte** diventano tre pallini per riga.

**Compatibilità**

- I documenti già salvati vengono convertiti in lettura conservando **ogni totale oggi visibile**: il sistema ricava gli input dai valori scritti a mano e deposita nel bonus vari la differenza che le regole non spiegano.

## Capabilities

### New Capabilities

Nessuna capability nuova: la change modifica il modello dati, le regole e la presentazione di una capability esistente.

### Modified Capabilities

- `character-sheet-management`: aggiunge i requisiti sui valori derivati dalle regole 5e, sulla competenza a tre livelli, sull'editor delle azioni, sulla riga compatta e sul blocco di sezione; modifica il requisito sui dati di personaggio e combattimento, quello sui dati degli incantesimi (caratteristica da incantatore tipizzata, CD e bonus di attacco calcolati), quello sulla compilazione manuale (che vietava i calcoli automatici) e quello sul collegamento fra scheda e token (l'iniziativa proiettata diventa il valore calcolato).

## Impact

- **Nuovo modulo condiviso**: le regole di calcolo vivono in un modulo importato sia da `server/` sia da `src/`, perché servono al client per la resa immediata, al server per la proiezione dell'iniziativa sul token e alla Fase B per costruire le formule.
- **Frontend**: `src/components/character-sheet/CharacterTab.tsx`, `SpellsTab.tsx`, `SheetPrimitives.tsx`, nuovo componente di editor, `src/styles/character-sheet.css`, `src/types/character-sheet.ts`, `clearOperations.ts`.
- **Backend**: `server/character-sheet-schema.mjs` per campi, domini, valori predefiniti, normalizzazione dei documenti legacy e percorsi patch ammessi; `server/character-sheet-service.mjs` per la proiezione dell'iniziativa, che da mappatura diretta di un campo diventa ricalcolo su cambio di Destrezza o bonus vari.
- **Database**: nessuna migrazione di schema. Il contenuto vive in `character_sheets.data_json` e viene adattato dalla normalizzazione in lettura, come già avviene per i documenti pre-riorganizzazione.
- **Sincronizzazione**: invariata. Editor, righe, indicatori e riquadri usano le stesse patch per campo, lo stesso controllo di versione, lo stesso stream SSE e la stessa persistenza con debounce di P0.4.
- **Test**: `test/character-sheet-schema.test.mjs`, `test/character-sheet-migration.test.mjs`, `test/character-sheet-service.test.mjs` e un nuovo test del modulo delle regole.
- **Documentazione**: `FEATURES_VTT.md` (P0.5 Fase A, già aggiornato) e i router `Docs/ai` frontend, backend e database; `npm run docs:check` resta parte della verifica.
- **Fuori ambito**: esecuzione dei tiri, formule inviate al server, voci di log ed effetti sui contatori prodotti da un tiro. Sono la Fase B. Le righe dei singoli incantesimi restano di consultazione e non diventano bersagli di tiro, come deciso per l'elenco dei bersagli della Fase B.
