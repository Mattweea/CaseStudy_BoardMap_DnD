## Why

La Fase A di P0.5 (`p0-5a-sheet-action-editors`) ha portato nella scheda le regole di calcolo 5e e i bersagli di click (`data-roll-source`), ma non esegue alcun tiro: ogni elemento cliccabile è oggi inerte. Lanciare un tiro dalla scheda è l'azione che Player e Master compiono più spesso durante una sessione (P0.5 in `FEATURES_VTT.md`), e il tiro libero di P0.3 costringe a riaprire una modale e a ricopiare a mano un valore già scritto sulla scheda. Questa change collega i bersagli già esistenti al motore dei tiri autorevole del server, così che un tiro tipico costi un solo click sull'elemento che lo rappresenta.

Questa change presuppone che `p0-5a-sheet-action-editors` sia mergiata: usa i suoi ancoraggi `data-roll-source`, il modello degli attacchi in `data_json` e il modulo condiviso `shared/dnd-rules.mjs`.

## What Changes

- Ogni bersaglio già anticipato dalla Fase A (sei caratteristiche, sei tiri salvezza, diciotto abilità, iniziativa, una riga per strumento, il tiro di attacco e il danno di una riga di attacco come bersagli distinti, il riquadro dadi vita, il riquadro dei salvataggi contro morte) diventa cliccabile: il click esegue subito il tiro, senza alcuna scelta preliminare. Ogni bersaglio `1d20` tira due dadi indipendenti (nessun vantaggio/svantaggio pre-scelto dal client): è chi legge il log a decidere quale dei due contare, come nel client di riferimento Roll20.
- Il server ricostruisce la formula dai campi correnti della scheda al momento del tiro, secondo la tabella dei bersagli di P0.5 Fase B, ignorando qualunque formula proposta dal client e riusando il generatore, le regole di visibilità e il formato di log già introdotti in P0.3 per il tiro libero.
- Un tiro su un bersaglio il cui valore non è interpretabile come numero viene rifiutato con un errore comprensibile, senza aggiungere una voce al log.
- Il tiro di un attacco produce nel log il tiro di attacco e il danno collegati (con il secondo blocco di danno quando attivo e il tiro salvezza subito dal bersaglio quando l'attacco lo prevede), applicando il raddoppio dei dadi danno quando il risultato naturale raggiunge la soglia di critico dell'attacco.
- Un dado vita lanciato usa il tipo scelto nel riquadro e ne fa calare i rimanenti di uno; un tiro salvezza contro la morte è `1d20` senza modificatori e riempie il pallino di successo o fallimento corrispondente. Entrambi gli effetti collaterali passano dalla stessa catena di patch, versione, SSE e persistenza con debounce già usata da P0.4/Fase A.
- Ogni voce di log generata dalla scheda riporta personaggio e azione, cosicché il log distingua ad esempio «Prova di Furtività» da «Attacco — Spada corta».
- Percezione passiva e le righe della tab Incantesimi restano di sola consultazione: nessun tiro parte da lì.

## Capabilities

### New Capabilities

- `character-sheet-roll-actions`: definisce l'interazione di tiro sui bersagli della scheda, la ricostruzione server-side della formula dalla tabella dei bersagli di Fase B, il collegamento del risultato al personaggio e all'azione nel log, il raddoppio dei dadi danno in caso di critico e gli effetti collaterali consentiti (dadi vita rimasti, pallini dei salvataggi contro morte) applicati tramite la stessa catena di patch della scheda.

### Modified Capabilities

Nessuna. `session-dice-rolling` fornisce già generatore, regole di visibilità e formato di log riusati qui senza cambiarne i requisiti; `character-sheet-management` resta la fonte dei campi e dei valori calcolati letti dal motore dei tiri.

## Impact

- **Backend**: `server/character-sheet-roll-resolver.mjs` accetta un riferimento a scheda e bersaglio invece di una formula libera, ricostruisce la formula dal documento corrente tramite `shared/dnd-rules.mjs` e dal modello degli attacchi, verifica che il richiedente possa leggere quella scheda e riusa il generatore di dadi già usato dal tiro libero. Il tiro di attacco e il danno di un attacco sono bersagli separati (`attack:<id>` e `attack-damage:<id>`); il critico è dichiarato dal client sul secondo, dedotto dal tiro di attacco più recente per lo stesso id. `server/character-sheet-service.mjs` applica gli effetti collaterali (dadi vita rimasti, pallini contro morte) come patch della scheda già validate da `server/character-sheet-schema.mjs`.
- **Frontend**: `src/components/character-sheet/CharacterTab.tsx` gestisce il click delegato sugli elementi `data-roll-source` esistenti, più un nuovo bersaglio `attack-damage:<id>` sulla colonna del danno di ogni riga di attacco. Nessuna modale precede più il tiro.
- **Condiviso**: eventuali funzioni di supporto alla ricostruzione della formula (ad esempio dal tipo di dado vita o dalla soglia di critico) restano in `shared/dnd-rules.mjs` o in un modulo affine, per non duplicare la logica fra client e server.
- **Test**: nuovi test del motore dei tiri della scheda (formula per ciascun bersaglio, rifiuto dei valori non numerici, autorizzazione, effetti collaterali, critico) accanto a `test/character-sheet-roll-targets.test.mjs`, `test/character-sheet-schema.test.mjs`, `test/character-sheet-service.test.mjs` e ai test esistenti del tiro libero.
- **Documentazione**: `FEATURES_VTT.md` (P0.5 Fase B, già descritta) e i router `Docs/ai` backend e frontend della scheda; `npm run docs:check` resta parte della verifica.
- **Fuori ambito**: il dado 3D e i modelli di probabilità del generatore sono P0.6; il collegamento del risultato dell'iniziativa al tracker è P0.8; il recupero del log dopo un riavvio è P0.11.
