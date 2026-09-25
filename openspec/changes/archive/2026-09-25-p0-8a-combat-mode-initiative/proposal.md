## Why

Oggi il combattimento non esiste come stato della sessione: «Avvia combattimento» mostra solo un annuncio, il budget di movimento scatta appena esiste una voce d'iniziativa, e l'iniziativa si tira nel browser del Master senza passare dal server né dal log. Il Player non può tirare la propria iniziativa, né dalla scheda né dal tracker, e gli spareggi li risolve il Master a mano. P0.8 (sezione in `FEATURES_VTT.md`) chiede di giocare un incontro come in un VTT. Questa è la prima delle tre change previste (`p0-8a`, `p0-8b`, `p0-8c`) e fornisce la struttura su cui si appoggiano HP e condizioni.

## What Changes

- Due modalità di sessione condivise, **Esplorazione** e **Combattimento**, commutate solo dal Master:
  - entrando in Combattimento il tracker si svuota, si apre una fase di tiro dell'iniziativa e il Master avvia il round 1;
  - uscendo, tracker, round, turno attivo e contabilità del movimento si azzerano.
- In Esplorazione il movimento è libero e il tiro d'iniziativa è rifiutato. In Combattimento il budget per round vale da quando parte il round 1. Prima di quel momento, durante la fase di tiro, il movimento resta libero e non addebitato, così il Master può far disporre i personaggi. **BREAKING** per la regola attuale, che applica il budget appena esiste una voce d'iniziativa.
- **Tiro d'iniziativa sul server**, con voce nel log:
  - si può tirare dalla scheda e dalla tab Turni di iniziativa;
  - l'Adventurer tira solo per il proprio personaggio, il Master per qualunque creatura, anche al posto di un Player;
  - «Tira per tutti» resta al Master e passa anch'esso dal server.
- **Modalità del tiro d'iniziativa sulla scheda, come in Roll20:**
  - un selettore Normale/Vantaggio/Svantaggio accanto al riquadro Iniziativa, salvato nella scheda;
  - il server tira con quella modalità e produce **un** valore;
  - è l'unica eccezione alla regola di P0.7.5 per cui un `d20` si risolve come coppia non scelta. **BREAKING** per il requisito del tiro doppio sul bersaglio iniziativa della scheda.
- **Ordine e spareggio come in Foundry:**
  - il valore più alto va prima;
  - a parità vince il modificatore di Destrezza più alto;
  - a parità ulteriore decide una frazione casuale generata dal server e mai mostrata;
  - lo spostamento esplicito del Master prevale su tutto e non è più limitato a voci con lo stesso valore.
- **Fine turno del Player:** un'impostazione del Master, spenta di default, permette all'Adventurer di chiudere il proprio turno quando il token attivo è il suo.
- **Annuncio e suoni:**
  - l'avvio del combattimento mostra a tutti spade incrociate davanti a uno scudo, con un effetto sonoro;
  - «Sei il prossimo!» e «Tocca a te!» restano visibili al solo Player interessato e guadagnano un suono;
  - l'audio è un asset locale CC0, con volume e silenziamento come preferenze locali nella tab Impostazioni.

## Capabilities

### New Capabilities

- `combat-session-mode`: modalità Esplorazione/Combattimento, ciclo di vita dell'incontro (fase di tiro, round 1, uscita), avanzamento del turno, fine turno opzionale del Player, annuncio d'avvio e suoni di combattimento.
- `initiative-rolling`: tiro d'iniziativa autorevole dalla scheda e dal tracker, modalità del tiro salvata nella scheda, autorizzazioni per ruolo, regole di ordinamento e spareggio, inserimento e spostamento da parte del Master.

### Modified Capabilities

- `initiative-presentation`:
  - il tracker mostra l'ordine autorevole, la modalità di sessione e la fase di tiro;
  - gli avvisi del Player hanno un suono;
  - viene rimosso il requisito «Confine della logica P0.3», ormai superato.
- `character-sheet-roll-actions`: il bersaglio Iniziativa esce dal tiro doppio non scelto, usa la modalità salvata nella scheda e alimenta il tracker.
- `character-sheet-management`: nuovo dato di scheda, la modalità del tiro d'iniziativa, modificabile da chi può modificare la scheda.
- `token-movement-and-measurement`: il budget di movimento dipende dalla modalità Combattimento e dall'avvio del round, non più dalla semplice presenza di voci d'iniziativa.
- `dice-3d-presentation`: a dadi fermi la mappa non mostra più il riepilogo testuale del tiro; la lettura resta al log dei dadi (richiesta emersa in revisione della change).
- `session-workspace`: la tab Impostazioni ospita anche le preferenze audio di combattimento e, per il solo Master, l'impostazione di fine turno del Player.

## Impact

- **Server** (`server/index.mjs`):
  - nuovi campi di stato condiviso con normalizzazione, compatibilità degli snapshot e sanitizzazione (la frazione di spareggio non raggiunge gli Adventurer);
  - nuovi endpoint per modalità di sessione, tiro d'iniziativa, tiro per tutti e fine turno;
  - `moveOwnedToken` condiziona il budget alla modalità di sessione.
- **Resolver e schema della scheda:**
  - `server/character-sheet-roll-resolver.mjs`: il bersaglio `initiative` ora produce un valore solo;
  - `server/character-sheet-schema.mjs`: nuovo campo `character.initiativeRollMode`, con default per le schede esistenti. Non serve una migrazione SQLite, perché il documento della scheda è JSON.
- **Motore dei dadi:** `shared/dice-engine.mjs` riattiva vantaggio e svantaggio per il solo chiamante dell'iniziativa. Nel log tornano dadi `discarded`, resi con pari enfasi.
- **Client:**
  - `src/hooks/useBattleMapState.ts`: nuove mutazioni con rollback ottimistico;
  - `src/types/index.ts`, `InitiativePanel.tsx`, `InitiativeRollModal.tsx` (il tiro locale viene rimosso), `CharacterTab.tsx`, `App.tsx` (annuncio, avvisi, audio), tab Impostazioni.
- **Asset:** effetti sonori CC0 in `public/media/audio` e icone game-icons.net già in uso.
- **Documentazione:** `Docs/ai/gameplay/combat_movement_and_dice.md`, `Docs/ai/backend/shared_state_and_persistence.md` e la sezione P0.8 di `FEATURES_VTT.md`.
- **Fuori da questa change:** HP (`p0-8b`), condizioni e velocità (`p0-8c`), PNG del Master nel tracker (P0.9).
