# Matrice di verifica P0.9d.4

Questo documento è una checklist di lavoro, non un'attestazione di esito. Registrare per ogni prova data, risultato ed eventuale difetto prima di completare le attività 2.x e 3.2.

## Fixture e ambiente

- Prove API automatiche: `BATTLE_MAP_TEST_MODE=1`, `app.inject` con sessioni distinte Master, Vesuth e Ilthar; per SQLite usare una directory temporanea univoca e `VTT_DB_PATH` assoluto. Storage di immagini e fixture legacy dei test usano directory temporanee e vengono rimossi dal test dopo la chiusura del database. Non usare `database/database.sqlite` nei test automatici.
- Prova UI/manuale: è autorizzato l'uso della partita corrente. Non azzerare database o `server/data`, non cancellare scene o snapshot; annotare gli ID delle due scene scelte e il loro stato iniziale prima di modificare. Master, Vesuth e Ilthar devono avere tre sessioni browser separate. Se una prova richiede un riavvio, annotare prima scena attiva, configurazione e stato live osservato.
- Scene: A con Vesuth e Ilthar live, B con sfondo immagine calibrato, dimensioni/griglia/unità distinte, buio e almeno un elemento scenico. Preparare su B un encounter quando P0.9e sarà disponibile. I nomi e gli ID reali vanno registrati al momento dell'esecuzione; non presumere che la partita corrente sia vuota.
- Legacy: usare la fixture temporanea di `test/scene-bootstrap.test.mjs` e `test/scene-migration.test.mjs`, non convertire a ritroso il database della partita corrente.

## Checklist Master + due Player

1. Aprire Master, Vesuth e Ilthar; verificare che entrambi i Player vedano soltanto la scena attiva e nessun catalogo/controllo Master.
2. Creare o selezionare A e B; modificare B senza attivarla. Controllare che i Player non ricevano documento, asset o drawing di B. Provare anche una scrittura con versione obsoleta.
3. Su B verificare sfondo bianco/immagine, calibrazione e griglia, dimensioni finite/illimitate, unità, diagonali, buio, drawing/undo/redo, elementi e flag indipendenti di blocco movimento/visuale.
4. Attivare B senza party: i tre client devono convergere sullo stesso `activeSceneId`; i token di A restano in A. Verificare reset degli strumenti locali e rifiuto di un evento o movimento riferito ad A.
5. Rientrare in A, selezionare B, calcolare anteprima e confermare «Attiva e trasferisci il party». Vesuth e Ilthar devono comparire in B con gli stessi ID; un nemico lasciato in A non deve trasferirsi. Ripetere con preview obsoleta o spazio insufficiente: scena e token devono restare invariati.
6. Passare Dungeon → Combattimento; durante un round attivo il cambio scena deve essere rifiutato per Master. Verificare che i Player non possano attivare, preparare o trasferire scene tramite API.
7. Disconnettere e riconnettere un Player: il primo snapshot deve riallinearlo alla scena attiva, senza riprodurre eventi effimeri della scena precedente.
8. Dopo P0.9e, preparare un encounter in B, attivarlo/disattivarlo secondo i suoi contratti, riavviare il server e verificare il recupero della sola configurazione/preparazione promessa. Non asserire recovery automatico di round, movimento o runtime completo.
9. Eseguire la fixture legacy su database temporaneo: import singolo della board iniziale, secondo avvio senza duplicati, poi utilizzo di una seconda scena.

## Tracciabilità dei requisiti

`A` indica un test automatico già presente; `M` un passo manuale/integrato ancora da eseguire. L'esistenza di `A` non prova da sola la sessione completa. I cinque requisiti P0.9e sono pianificati ma non ancora implementati.

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
| P0.9e.1 Lifecycle encounter | M 8 dopo implementazione |
| P0.9e.2 Entità mostro/PNG | M 8 dopo implementazione |
| P0.9e.3 Dati mostro/PNG | M 8 dopo implementazione |
| P0.9e.4 Placement/preparazione | M 8 dopo implementazione |
| P0.9e.5 Persistenza configurazione | M 8 dopo implementazione |
| P0.9d.4 Verifica integrata | M 1-9, evidenze finali in questo change |

Controlli trasversali: modalità/round in `combat-session-mode`, unità/diagonali e movimento in `token-movement-and-measurement`; le prove M 3 e 6 verificano che la transizione di scena non rompa questi contratti. Per P0.10 si controllano solo i filtri Player attuali; la segretezza completa del payload non è un criterio P0.9. Per P0.11 non si pretende il recupero del runtime live completo.

## Evidenza preliminare (2026-09-30)

- `npm test`: 42 file/test di suite passati, 0 falliti. Comprende i test di scene, SSE Master + due Player, trasferimento, migrazione e repository; non sostituisce il flusso UI completo.
- `npm run build`: superato; resta l'avviso Vite non bloccante sul chunk superiore a 500 kB.
- `npm run docs:check`: superato, 22 artefatti raggiungibili.
- `git diff --check`: superato.
- `openspec validate p0-9d-4-integration-multiclient-verification --strict --no-interactive`: superato.
- Server locale raggiungibile su `127.0.0.1:3001` con richiesta di sessione; non sono state effettuate mutazioni sulla partita corrente. Nessuna verifica UI con tre sessioni è ancora attestata.
- Blocco per la chiusura: P0.9e.1–e.5 sono ancora change attive con attività non completate; pertanto encounter e recupero della sua preparazione non sono verificabili. Anche le prove manuali M 1–9 e il confronto finale 3.2 restano da registrare. Ripetere i controlli di progetto dopo l'eventuale implementazione P0.9e.
