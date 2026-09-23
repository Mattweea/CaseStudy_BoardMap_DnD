## 1. Dipendenza e asset del renderer

- [x] 1.1 Aggiungere `@3d-dice/dice-box-threejs` alla versione esatta approvata e verificare che installazione e lockfile risolvano la stessa versione con `npm install` e `npm ls @3d-dice/dice-box-threejs`.
- [x] 1.2 Introdurre la dichiarazione TypeScript minima delle sole API usate e verificare con `npm run build` che import dinamico, configurazione e chiamate del renderer siano tipizzati senza `any` applicativi non motivati.
- [x] 1.3 Aggiungere uno script riproducibile per copiare gli asset richiesti in `public`, collegarlo al flusso di build/installazione e verificare su una directory pulita che `npm run build` includa tutti i file referenziati senza accessi a CDN.

## 2. Adapter autorevole e modello di presentazione

- [x] 2.1 Implementare il validatore/adapter puro da `DiceRollLog.dice` alla sequenza di facce forzate e al result rail, preservando ordine, `id`, `groupId` e `disposition`; verificare con test che un tiro libero e uno da scheda usino esclusivamente il dettaglio del log e non ricostruiscano la formula.
- [x] 2.2 Implementare la traduzione percentile d100 in due modelli visivi e verificare con test tabellari almeno `1`, `7`, `10`, `40`, `99` e `100`, compresa la lettura `07`, `40` e `00` come 100.
- [x] 2.3 Applicare il limite di 20 dadi logici e il fallback all-or-nothing per dettaglio assente, lati/valori/disposizioni non validi, id duplicati o quantità eccessiva; verificare con test che nessun sottoinsieme venga inviato al renderer e che il log originale resti immutato.
- [x] 2.4 Costruire il modello del result rail con gruppi distinguibili e stili semantici `kept`, `discarded` e `unresolved`; verificare con test che vantaggio/svantaggio, coppia non risolta e danno multi-gruppo mantengano identità, ordine ed enfasi previsti.

## 3. Consegne live, baseline e coda

- [x] 3.1 Estrarre una funzione pura che confronti snapshot normalizzati e produca nuove consegne in ordine senza duplicati; verificare con test snapshot iniziale, aggiornamento incrementale, cancellazione log e log legacy.
- [x] 3.2 Estendere `useBattleMapState` con un feed esclusivamente locale che tratti il caricamento iniziale e il primo snapshot di ogni generazione SSE come baseline, senza modificare `BattleMapSharedState`; verificare con test che risposta HTTP e broadcast dello stesso id generino una sola consegna e che i log arrivati durante una disconnessione non vengano animati alla riconnessione.
- [x] 3.3 Implementare il controller FIFO con deduplica per id, un solo consumer, timeout e avanzamento dopo errore; verificare con test asincroni che due tiri ravvicinati siano eseguiti una volta e in ordine e che timeout/fallimento del primo non blocchino il secondo.
- [x] 3.4 Collegare il controller soltanto ai log già sanitizzati del client e verificare manualmente con Master e Player in due sessioni che un tiro pubblico si animi su entrambi e un tiro segreto solo sui destinatari ai quali compare nel log.

## 4. Overlay React e integrazione con la board

- [x] 4.1 Implementare `Dice3DOverlay` con import lazy, inizializzazione unica, valori forzati, audio disattivato, pulizia tra tiri e result rail; verificare manualmente che `2d6+1` si fermi sui due valori del log e che totale/modificatore siano visibili immediatamente senza attendere la scena.
- [x] 4.2 Esporre dalla `Board` l'host attivo e montare un solo overlay controllato da `App`, riutilizzandolo nel passaggio tra board ordinaria e fullscreen; verificare manualmente che un tiro iniziato durante entrambe le transizioni non si duplichi e resti confinato alla superficie visibile.
- [x] 4.3 Rendere canvas e rail assoluti, trasparenti agli eventi, non focalizzabili e indipendenti da camera/zoom; verificare manualmente durante un tiro drag, selezione, zoom, controlli laterali e scheda, controllando che il focus corrente e le coordinate della board non cambino.
- [x] 4.4 Gestire resize dell'host, viewport stretti e inattività della scena; verificare manualmente che dadi e rail restino entro la board in layout desktop, viewport stretta e fullscreen e che il canvas venga nascosto al termine senza smontare una seconda istanza.

## 5. Fallback, accessibilità e resilienza

- [x] 5.1 Verificare `prefers-reduced-motion` e disponibilità effettiva di WebGL prima dell'import del renderer, reagendo ai cambi della media query; verificare con test delle funzioni di capability e manualmente che movimento ridotto/WebGL assente mantengano solo il risultato numerico senza richieste agli asset 3D.
- [x] 5.2 Isolare errori di import, asset, inizializzazione, roll e timeout, marcando la voce gestita e continuando la coda senza toast bloccanti; verificare con fault injection che il log resti intatto, il renderer venga disabilitato quando necessario e un tiro successivo non blocchi l'app.
- [x] 5.3 Verificare accessibilità dell'integrazione controllando che la grafica sia ignorata dalle tecnologie assistive, non aggiunga live region duplicate e non sottragga focus; documentare l'esito della verifica manuale perché il progetto non dispone di un runner DOM/WebGL.

## 6. Documentazione e verifica finale

- [x] 6.1 Aggiornare le foglie routed applicabili in `Docs/ai` con ownership dell'overlay, feed locale/baseline, invarianti autorevoli, fallback e gestione riproducibile degli asset, senza duplicare i requisiti OpenSpec; verificare raggiungibilità dai router e `npm run docs:check`.
- [x] 6.2 Eseguire l'intera suite automatica con `npm test`, quindi `npm run build`, `npm run docs:check` e `git diff --check`, correggendo ogni regressione prima di spuntare l'attività.
- [x] 6.3 Eseguire la matrice manuale completa su board normale/fullscreen e due client: tiro libero, tiro da scheda, vantaggio/svantaggio, coppia unresolved, danno multi-gruppo, d100 `7/40/100`, tiri ravvicinati, riconnessione e fallback; registrare nel resoconto finale eventuali scenari non eseguiti e il motivo.
- [x] 6.4 Confrontare implementazione e test con ogni scenario di `dice-3d-presentation`, quindi eseguire `openspec validate p0-6b-authoritative-dice-3d --strict --no-interactive` e lasciare l'archiviazione separata fino all'approvazione dell'utente.
