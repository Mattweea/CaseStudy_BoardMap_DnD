## 1. Stato condiviso e normalizzazione

- [x] 1.1 Aggiungere `sessionMode`, `isRoundStarted`, `playersCanEndTurn` e i campi `dexModifier`, `tiebreaker`, `mode` di `InitiativeEntry` a `src/types/index.ts` e alla forma server, con default e invarianti per modalità (design, decisione 1) sia in `normalizeSharedState` server sia nel hook client. Verifica: nuovo `test/combat-session-state.test.mjs` copre stato vuoto, snapshot legacy senza voci (→ Esplorazione), snapshot legacy con voci e turno attivo (→ Combattimento a round avviato, stesso ordine e round), voci senza frazione (il server la genera, il client no) e Esplorazione con voci residue (svuotate).
- [x] 1.2 Rimuovere `tiebreaker` dalle voci nella sanitizzazione per gli Adventurer, lasciandolo al Master. Verifica: un test su `sanitizeStateForUser` controlla entrambi i ruoli, per HTTP e SSE.
- [x] 1.3 Creare in `shared/` `compareInitiative` e la funzione d'inserimento senza riordino globale (decisione 5). Verifica: `test/initiative-order.test.mjs` copre parità risolta dalla Destrezza, parità completa decisa dalla frazione, inserimento dopo uno spostamento del Master senza toccare le altre voci, sostituzione di una voce.

## 2. Ciclo di vita dell'incontro (server)

- [x] 2.1 Estendere `POST /api/battle-map/combat/start` (ingresso in Combattimento: azzeramenti, fase di tiro, annuncio con titolo corretto) e aggiungere `POST /api/battle-map/combat/end` e `POST /api/battle-map/combat/round/start`, solo Master, con undo a snapshot del Master, incremento di versione e broadcast. Verifica: test di route per 403 dell'Adventurer, round 1 rifiutato con ordine vuoto, azzeramenti all'ingresso e all'uscita, un solo nuovo id di annuncio per ingresso.
- [x] 2.2 Aggiungere `POST /api/battle-map/turn/advance` basato su `applyRoundWrapState`: Master in entrambe le direzioni; Adventurer solo `next`, con `playersCanEndTurn` attivo e token attivo proprio; rifiuto in Esplorazione e in fase di tiro. Verifica: test per fine round (round +1, movimento azzerato), arretramento sotto 1, impostazione disattivata, turno altrui, richiesta fuori dal round.
- [x] 2.3 Aggiungere `POST /api/battle-map/settings/players-can-end-turn`, solo Master. Verifica: test di 403 per l'Adventurer e di broadcast del nuovo valore.
- [x] 2.4 Limitare `getTurnNotice` al round avviato. Verifica: un test controlla che in fase di tiro non esista alcun avviso e che a round avviato gli avvisi `next`/`turn` restino calcolati per il solo Player interessato.

## 3. Tiro d'iniziativa autorevole

- [x] 3.1 Aggiungere `character.initiativeRollMode` a schema, validazione, regola di patch enum e dati iniziali; completare in lettura le schede esistenti con `normal`, senza leggere il roster. Verifica: `test/character-sheet-schema.test.mjs` e `test/character-sheet-service.test.mjs` coprono valore non ammesso rifiutato, default `normal` anche per Ragnar senza incremento di versione, patch di un utente non autorizzato rifiutata.
- [x] 3.2 Creare `server/initiative-roll.mjs` (decisione 3): autorizzazione per ruolo, rifiuto in Esplorazione, token esclusi o non creature, secondo tiro dell'Adventurer, modalità dalla scheda o scelta dal Master solo per token senza scheda, `dexModifier`, log pubblico o segreto. Verifica: `test/initiative-roll.test.mjs` con entropia deterministica copre Vantaggio (`7` e `15`, `+2` → `17`, un dado `kept` e uno `discarded`), Svantaggio, modalità dichiarata dall'Adventurer ignorata, valore dichiarato dal client ignorato, visibilità segreta per un mostro.
- [x] 3.3 Esporre `POST /api/battle-map/initiative/roll` e `POST /api/battle-map/initiative/roll-all` (solo Master, solo creature prive di voce), con commit atomica di voce e log e un solo incremento di versione. Verifica: test di route per il Master che tira per un Player assente, «Tira per tutti» che non sovrascrive una voce esistente, due richieste consecutive per lo stesso token (una voce e un log), log escluso dal destinatario sbagliato via SSE.
- [x] 3.4 Far passare il bersaglio `initiative` di `POST /api/battle-map/rolls` per il nuovo modulo, ricavando il token collegato alla scheda, ignorando l'interruttore segreto e rifiutando scheda senza token ed Esplorazione. Verifica: aggiornare `test/character-sheet-roll-targets.test.mjs` e `test/character-sheet-roll-resolver.test.mjs`: l'iniziativa produce un valore solo e scrive il tracker, gli altri bersagli `1d20` restano doppi `unresolved`.

## 4. Movimento

- [x] 4.1 Sostituire in `moveOwnedToken` il predicato `initiatives.length > 0` con `sessionMode === 'combat' && isRoundStarted`; in fase di tiro e in Esplorazione non addebitare movimento né alternanza diagonale (la fase di tiro serve anche a disporre i personaggi). Verifica: estendere `test/battle-map-movement.test.mjs` con Esplorazione (10 caselle con velocità 6 accettate, movimento usato `0`), fase di tiro libera e non addebitata, round avviato che rispetta il budget, Master libero in ogni modalità.
- [x] 4.2 Allineare pianificazione, riga di suggerimento e comando di scatto al nuovo predicato. Verifica manuale su due client: in Esplorazione il percorso non mostra il budget, a round avviato sì. `npm run build` passa.

## 5. Client: hook e tracker

- [x] 5.1 In `useBattleMapState.ts` aggiungere le mutazioni per ingresso e uscita dal combattimento, avvio del round, avanzamento, fine turno, tiro, tiro per tutti e impostazione di fine turno, con coda e riallineamento dallo snapshot in caso di rifiuto; sostituire `cycleTurn` con l'endpoint; togliere il limite «stesso valore» dal riordino. Verifica: `npm run build`; manuale su due client con un rifiuto (Adventurer in fase di tiro con voce già presente) e riallineamento dello stato.
- [x] 5.2 Rifare `InitiativePanel`: modalità e fase visibili; comandi del Master (Combattimento, round 1, avanti/indietro, tira per tutti, inserimento manuale, rimozione, drag libero); comando di tiro per l'Adventurer solo quando accettabile; fine turno quando consentito; valori senza frazione; stato vuoto che spiega l'Esplorazione. Verifica: manuale da tastiera come Master e come Adventurer, contro gli scenari della spec `initiative-presentation`.
- [x] 5.3 Ridurre `InitiativeRollModal` a strumento del Master senza tiro locale: per riga, tiro sul server con scelta Normale/Vantaggio/Svantaggio solo per token senza scheda, valore manuale, rimozione. Verifica: `grep` di `rollDice`/`rollSingleDie` nel componente senza risultati; manuale con un token senza scheda tirato in Svantaggio.

## 6. Client: scheda

- [x] 6.1 In `CharacterTab.tsx` aggiungere il pulsante con icona di impostazioni accanto all'Iniziativa, il gruppo radio accessibile da tastiera, l'etichetta `V`/`S` sul riquadro e il bersaglio Iniziativa disabilitato con spiegazione in Esplorazione. Verifica: manuale come Adventurer (scelta Vantaggio salvata e sincronizzata su un secondo client; click in Esplorazione disabilitato; tiro in Combattimento che compare nel tracker); `npm run build`.

## 7. Annuncio e audio

- [x] 7.1 Selezionare tre suoni CC0 (corno da battaglia OpenGameArt, Kenney Interface Sounds, tamburi sintetizzati per il progetto), convertirli in `.ogg` in `public/media/audio/` e registrarne l'origine nell'elenco delle attribuzioni. Verifica: i file sono presenti, sotto i 100 KB ciascuno, e la tab Impostazioni cita la fonte.
- [x] 7.2 Creare `shared/combat-audio-preferences.mjs` e `useCombatAudioPreferences`, con silenziamento e volume nella tab Impostazioni; aggiungere per il solo Master l'interruttore «I giocatori possono terminare il proprio turno» e per l'Adventurer il suo stato in sola lettura. Verifica: `test/combat-audio-preferences.test.mjs` sul modello di `dice-presentation-preferences.test.mjs` (default, valori invalidi, storage non disponibile); manuale sulla tab con entrambi i ruoli.
- [x] 7.3 Mostrare nell'annuncio l'emblema SVG spade e scudo (game-icons.net, attribuzione aggiornata) e riprodurre i suoni all'arrivo di un nuovo annuncio e di un nuovo `turnNotice`, intercettando il rifiuto di `play()`. Verifica: manuale su tre client (Master e due Adventurer): tutti sentono l'annuncio una volta, soltanto il Player interessato vede e sente «Sei il prossimo!» e «Tocca a te!», con il suono silenziato la modale compare lo stesso, e una riconnessione non ripropone l'annuncio.

## 7b. Revisione dopo la prima prova

- [x] 7.4 Rimuovere dalla mappa il riepilogo testuale del tiro 3D (`dice-3d-result-rail`), lasciando la lettura al log. Verifica: `npm run build`, `npm test`, delta `dice-3d-presentation` valida.

## 8. Documentazione e verifica finale

- [x] 8.1 Aggiornare `Docs/ai/gameplay/combat_movement_and_dice.md` (modalità di sessione, fase di tiro, ordinamento e spareggio, tiro d'iniziativa autorevole, budget legato alla modalità, `discarded` di nuovo prodotto dall'iniziativa, riga su Ragnar sostituita dalla modalità scelta nella scheda) e `Docs/ai/backend/shared_state_and_persistence.md` (nuovi campi, compatibilità degli snapshot, sanitizzazione di `tiebreaker`, nuovi endpoint e scelte di undo). Aggiornare lo stato della sezione P0.8 in `FEATURES_VTT.md`. Verifica: `npm run docs:check` e `git diff --check` passano.
- [x] 8.2 Eseguire `npm test`, `npm run build` e `openspec validate p0-8a-combat-mode-initiative --strict --no-interactive`. Verifica: tutti passano.
- [x] 8.3 Verifica end-to-end dell'accettazione su Master e due Adventurer:
  - ingresso in Combattimento con annuncio;
  - Vantaggio impostato dalla scheda e tiro;
  - parità ordinata per Destrezza;
  - Master che tira per un assente e sposta una voce;
  - round 1 e avanzamento con avvisi riservati;
  - fine turno consentita dal Master;
  - uscita in Esplorazione con movimento libero e tracker vuoto;
  - suspend e resume a metà incontro.

  Verifica: l'esito di ogni scenario è riportato nel riepilogo della change.
