# Matrice di verifica P0.9d.4

La matrice collega requisiti, prove automatiche e accettazione UI. Le sezioni datate distinguono l'evidenza preliminare dalla verifica finale e dalle approvazioni dell'utente.

## Fixture e ambiente

- Prove API automatiche: `BATTLE_MAP_TEST_MODE=1`, `app.inject` con sessioni distinte Master, Vesuth e Ilthar; per SQLite usare una directory temporanea univoca e `VTT_DB_PATH` assoluto. Storage di immagini e fixture legacy dei test usano directory temporanee e vengono rimossi dal test dopo la chiusura del database. Non usare `database/database.sqlite` nei test automatici.
- Prova integrata `test/multi-scene-session.test.mjs`: avvio dell'entrypoint di produzione su loopback e porta casuale, tre login SQLite effettivi e connessioni HTTP/SSE reali. Sorgenti `.mjs` copiati in una directory temporanea, senza dati runtime; anche snapshot legacy, sfondi e ritratti sono isolati. Chiusura client e processo prima della rimozione del fixture. Nessun riavvio del server della partita corrente.
- Prova UI/manuale: è autorizzato l'uso della partita corrente. Non azzerare database o `server/data`, non cancellare scene o snapshot; annotare gli ID delle due scene scelte e il loro stato iniziale prima di modificare. Master, Vesuth e Ilthar devono avere tre sessioni browser separate. Se una prova richiede un riavvio, annotare prima scena attiva, configurazione e stato live osservato.
- Scene: A con Vesuth e Ilthar live, B con sfondo immagine calibrato, dimensioni/griglia/unità distinte, buio, elementi scenici ed encounter con mostro visibile e PNG nascosto. La prova automatica usa A `initial-scene` importata dal legacy e B `Fortezza` con ID assegnato dal server, conservato dinamicamente nelle asserzioni. Le prove sulla partita corrente richiedono invece di annotare i suoi ID e lo stato iniziale.
- Legacy: usare la fixture temporanea di `test/scene-bootstrap.test.mjs` e `test/scene-migration.test.mjs`, non convertire a ritroso il database della partita corrente.

## Checklist Master + due Player

1. Aprire Master, Vesuth e Ilthar; verificare che entrambi i Player vedano soltanto la scena attiva e nessun catalogo/controllo Master.
2. Creare o selezionare A e B; modificare B senza attivarla. Controllare che i Player non ricevano documento, asset o drawing di B. Provare anche una scrittura con versione obsoleta.
3. Su B verificare sfondo bianco/immagine, calibrazione e griglia, dimensioni finite/illimitate, unità, diagonali, buio, drawing/undo/redo, elementi e flag indipendenti di blocco movimento/visuale.
4. Attivare B senza party: i tre client devono convergere sullo stesso `activeSceneId`; i token di A restano in A. Verificare reset degli strumenti locali e rifiuto di un evento o movimento riferito ad A.
5. Rientrare in A, selezionare B, calcolare anteprima e confermare «Attiva e trasferisci il party». Vesuth e Ilthar devono comparire in B con gli stessi ID; un nemico lasciato in A non deve trasferirsi. Ripetere con preview obsoleta o spazio insufficiente: scena e token devono restare invariati.
6. Passare Dungeon → Combattimento; durante un round attivo il cambio scena deve essere rifiutato per Master. Verificare che i Player non possano attivare, preparare o trasferire scene tramite API.
7. Disconnettere e riconnettere un Player: il primo snapshot deve riallinearlo alla scena attiva, senza riprodurre eventi effimeri della scena precedente.
8. Preparare un encounter in B e collocarne le figure; attivare B, tornare in A e rientrare in B. Riavviare il server isolato e verificare il recupero della sola configurazione/preparazione promessa. Non asserire recovery automatico di round, movimento o runtime completo.
9. Eseguire la fixture legacy su database temporaneo: import singolo della board iniziale, secondo avvio senza duplicati, poi utilizzo di una seconda scena.

## Tracciabilità dei requisiti

`A` indica un test automatico; `M` un passo della checklist visiva. La prova `multi-scene-session.test.mjs` attraversa insieme i contratti server dei passi 1–9, con HTTP/SSE reali. Le verifiche UI hanno l'accettazione utente registrata sotto; nessuna nuova esecuzione browser dell'agente è attribuita a questa prova.

| Requisito | Evidenza prevista |
|---|---|
| P0.9a.1 Modello di scena versionato e normalizzato | A `scene-model.test.mjs`; M 2 |
| P0.9a.2 Persistenza e migrazione legacy | A `scene-repository.test.mjs`, `scene-bootstrap.test.mjs`, `scene-migration.test.mjs`; M 8-9 |
| P0.9a.3 Catalogo scene Master | A `scene-routes.test.mjs`, `battle-map-active-scene-views.test.mjs`; M 1-2 |
| P0.9a.4 Una scena attiva integrata | A `active-scene-projection.test.mjs`, `scene-routes.test.mjs`; M 4 |
| Dimensioni finite o illimitate | A `scene-model.test.mjs`, `battle-map-movement.test.mjs`; M 3 |
| P0.9b.1 Background bianco o immagine | A `scene-background-routes.test.mjs`, `scene-background-storage.test.mjs`; M 3 |
| P0.9b.2 Integrazione con griglia | A `scene-background-calibration.test.mjs`; M 3 |
| P0.9b.3 Calibrazione immagine | A `scene-background-calibration.test.mjs`, `scene-routes.test.mjs`; M 3 |
| P0.9b.4 Switch Dungeon/Combattimento | A `battle-map-movement.test.mjs`; M 6 |
| Preview live confini board | A `scene-model.test.mjs`; M 3 |
| Board senza confini | A `scene-model.test.mjs`, `battle-map-movement.test.mjs`; M 3 |
| P0.9b.5 Controllo buio per scena | A `scene-routes.test.mjs`; M 3-4 |
| P0.9c.1 Drawing distinto da elementi/token | A `scene-routes.test.mjs`, `scene-model.test.mjs`; M 3 |
| P0.9c.2 Undo/redo drawing | A `scene-service.test.mjs`, `scene-routes.test.mjs`; M 3 |
| P0.9c.3 Elementi scenici trasformabili | A `scene-model.test.mjs`, `scene-routes.test.mjs`; M 3 |
| P0.9c.4 Blocchi movimento/visuale | A `scene-blockers.test.mjs`, `scene-vision.test.mjs`, `battle-map-movement.test.mjs`; M 3 |
| P0.9d.1 Transizione realtime | A `battle-map-active-scene-views.test.mjs`, `scene-routes.test.mjs`; M 4, 6-7 |
| P0.9d.2 Isolamento Player | A `battle-map-active-scene-views.test.mjs`, `battle-map-movement.test.mjs`; M 1-2, 4, 7 |
| P0.9d.3 Runtime live distinto | A `battle-map-active-scene-views.test.mjs`, `party-transfer.test.mjs`; M 4-5 |
| P0.9d.3 Trasferimento atomico | A `party-transfer.test.mjs`; M 5 |
| P0.9e.1 Lifecycle encounter | A `scene-routes.test.mjs`, `multi-scene-session.test.mjs`; M 8 |
| P0.9e.2 Entità mostro/PNG | A `encounter-token.test.mjs`, `scene-routes.test.mjs`, `multi-scene-session.test.mjs`; M 8 |
| P0.9e.3 Dati mostro/PNG | A `scene-model.test.mjs`, `scene-routes.test.mjs`, `encounter-external-boundary.test.mjs`, `multi-scene-session.test.mjs`; M 8 |
| P0.9e.4 Placement/preparazione | A `encounter-placement.test.mjs`, `encounter-placement-ui.test.mjs`, `multi-scene-session.test.mjs`; M 8 |
| P0.9e.5 Persistenza configurazione | A `encounter-persistence.test.mjs`, `multi-scene-session.test.mjs`; M 8 |
| P0.9d.4 Verifica integrata | A `multi-scene-session.test.mjs`; M 1-9 con accettazione utente ed evidenze finali sotto |

Controlli trasversali: modalità/round in `combat-session-mode`, unità/diagonali e movimento in `token-movement-and-measurement`; le prove M 3 e 6 verificano che la transizione di scena non rompa questi contratti. Per P0.10 si controllano solo i filtri Player attuali; la segretezza completa del payload non è un criterio P0.9. Per P0.11 non si pretende il recupero del runtime live completo.

## Evidenza preliminare (2026-09-30)

- `npm test`: 42 file/test di suite passati, 0 falliti. Comprende i test di scene, SSE Master + due Player, trasferimento, migrazione e repository; non sostituisce il flusso UI completo.
- `npm run build`: superato; resta l'avviso Vite non bloccante sul chunk superiore a 500 kB.
- `npm run docs:check`: superato, 22 artefatti raggiungibili.
- `git diff --check`: superato.
- `openspec validate p0-9d-4-integration-multiclient-verification --strict --no-interactive`: superato.
- Server locale raggiungibile su `127.0.0.1:3001` con richiesta di sessione; non sono state effettuate mutazioni sulla partita corrente. Nessuna verifica UI con tre sessioni è ancora attestata.
- Blocco per la chiusura: P0.9e.1–e.5 sono ancora change attive con attività non completate; pertanto encounter e recupero della sua preparazione non sono verificabili. Anche le prove manuali M 1–9 e il confronto finale 3.2 restano da registrare. Ripetere i controlli di progetto dopo l'eventuale implementazione P0.9e.

## Approvazione utente delle verifiche precedenti — 2026-10-19

- L'utente dichiara funzionanti le funzionalità disponibili e richiede di segnare tutti i test precedenti come approvati. Si registra approvazione UI per scene/catalogo, sfondo/calibrazione/griglia, dimensioni, buio, drawing, elementi e blocker, transizione/trasferimento, controlli di ruolo e riconnessione, CRUD encounter e figure manuali E.1–E.3, zoom orizzontale e seguito del PG.
- Questa è approvazione dell'utente, non una nuova esecuzione browser dell'agente. Non vengono inventati ID di scene, sessioni o misure di runtime.
- I controlli automatici della change camera sono passati: 46 file di suite, build, docs:check e diff:check. La verifica della camera è dettagliata nella change `follow-player-movement-camera`.
- Il task 2.2 è approvato per i flussi disponibili. Il task 2.1 resta parziale fino al placement E.4; il task 2.3 e il confronto finale 3.2 restano aperti fino alla verifica integrata di encounter, persistenza/riavvio e compatibilità legacy. L'approvazione non marca come implementate E.4/E.5.

## Verifica finale integrata — 2026-10-19

Le limitazioni sulle dipendenze riportate nelle sezioni precedenti sono storiche: E.4 ed E.5 sono completate. L'utente ha inoltre confermato che mostri e PNG funzionano e possono essere collocati, accettando il flusso attuale e rimandando il refactoring degli encounter. Questa accettazione completa quella UI dei flussi precedenti; non viene estesa a funzionalità future P0.10/P0.11.

### Sessione completa

`test/multi-scene-session.test.mjs` esegue un flusso unico con il server di produzione, senza `BATTLE_MAP_TEST_MODE`, tre sessioni autenticate e stream SSE reali:

1. Parte da un database migrato vuoto e da uno snapshot legacy temporaneo. A viene importata una sola volta con unità, diagonali e luce originarie; i token esclusivamente live dello snapshot non sono ripresi automaticamente.
2. Master, Vesuth e Ilthar accedono. Il Master crea B e prepara sfondo PNG, calibrazione, dimensioni, buio, drawing con undo/redo, due elementi con flag blocker indipendenti, encounter, mostro visibile e PNG nascosto. La preparazione inattiva non avanza la versione condivisa né emette eventi sui tre stream.
3. La prima attivazione di B materializza le figure e lascia i PG in A. Master e Player ricevono proiezioni HTTP/SSE concordi con il proprio ruolo; i Player non ricevono il PNG nascosto, definizioni private o catalogo. Possono scaricare lo sfondo solo dopo l'attivazione. Un nuovo login del PG rimasto in A non lo duplica in B; una richiesta riferita ad A viene rifiutata con 409.
4. Tornando ad A, il Master calcola la preview e attiva B trasferendo entrambi i PG. Una conferma con versione live errata è rifiutata; quella corrente conserva ID e ownership e produce un solo snapshot per connessione. Impostazioni, elementi, mostro e PNG convivono con il party senza sovrapposizioni.
5. Il movimento Player è rifiutato dal blocker, mentre una destinazione libera è accettata. Un ping raggiunge gli stream connessi; un Player riconnesso riceve lo snapshot corrente senza replay del ping. Entrata in Combat, tiro iniziativa e avvio round usano le route reali; lo switch durante il round è rifiutato senza cambiare stato.
6. HP, condizioni e posizione live del mostro sopravvivono all'uscita e al rientro nella scena. La modifica successiva del nome della figura aggiorna l'istanza esistente senza ripristinare HP, posizione o condizioni. Il documento conserva invece gli HP e la posizione preparati.

### Riavvio e compatibilità

La prova termina e riavvia il solo processo temporaneo dopo avere sostituito lo snapshot legacy con valori diversi. Il catalogo rimane composto da A e B, la scena attiva è ancora B, documenti e versioni sono identici e la history drawing riparte vuota. Gli asset rimangono leggibili e i placement tornano con gli HP, posizioni e hidden preparati. I vecchi cookie non sono più validi; dopo un nuovo login entrambi i Player funzionano sulla scena recuperata con le stesse regole di sanitizzazione.

Questo verifica gli scenari «Sessione completa», «Riavvio P0.9» e «Compatibilità legacy» della delta D.4. Lo scenario «Confine P0.10» è coperto dai controlli di ruolo, scena inattiva e hidden, senza affermare che ogni segreto oltre il fog sia assente dal payload. Il recupero delle modifiche live, dei token creati solo durante il gioco e dei runtime inattivi resta P0.11. Le prove focalizzate di concorrenza, rollback SQLite, veicoli/familiari, visione e reset client rimangono nella matrice sopra.

### Confronto con le delta P0.9

La matrice è stata confrontata con le 22 foglie e le capability correnti `scene-management`, `scene-map-presentation`, `scene-authoring`, `multi-scene-session`, `encounter-management`, oltre alle modifiche di unità/modalità in `token-movement-and-measurement` e `combat-session-mode`. Il seguito camera è verificato separatamente dalla sua change e dai test `board-camera*`.

La revisione rileva e risolve un conflitto testuale tra E.3 («Modifica manuale» senza effetti live, prima dei placement) e la riconciliazione per differenze introdotta da E.4. La delta E.4 include ora la modifica completa del requisito E.3: nessuna nuova istanza implicita; le istanze già collocate ricevono solo le proprietà iniziali cambiate. La prova integrata conferma nome aggiornato e HP/condizioni/posizione live conservati. Non cambia il codice applicativo o il comportamento accettato. Sincronizzare E.3 prima di E.4, poi E.5, rispetta questa dipendenza.

Le delta implementate sono state sincronizzate nelle specifiche canoniche seguendo tale ordine; anche D.4 e il seguito camera sono sincronizzati in `multi-scene-session` e `session-workspace`. `openspec validate --specs --strict --no-interactive` passa su tutte le 18 capability. Le change restano nelle directory attive fino al passo distinto di archiviazione.

### Controlli e limiti

- `node test/multi-scene-session.test.mjs`: superato, incluso riavvio reale.
- `npm test`: 337 test passati, zero fallimenti, zero skip.
- `npm run build`: superato; resta l'avviso preesistente Vite sul chunk DiceBox superiore a 500 kB.
- `npm run docs:check`: superato, 22 artefatti raggiungibili.
- `git diff --check`: superato.
- `openspec validate --all --strict --no-interactive`: superato, 24 elementi validi.
- Prova eseguita con supporto a sottoprocessi e socket locali fuori dai limiti del sandbox. Nessun database, asset o processo della partita corrente è stato modificato.
- Nessuna nuova sessione browser o verifica visiva a tre finestre è eseguita dall'agente. Per gli aspetti di layout/gesto si usano l'accettazione utente registrata e i test componenti già indicati; questi ultimi hanno hook/geometria simulati. Non sono equivalenti a un browser.

I task 2.1 e 2.3 sono chiusi con la nuova prova integrata; 3.2 con il confronto sopra. L'archiviazione delle foglie e della change di coordinamento rimane un passo distinto.
