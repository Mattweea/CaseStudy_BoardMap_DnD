## 1. Modello e persistenza

- [x] 1.1 Aggiungere polilinee walls e tipi condivisi, ID/limiti validati e default [] senza convertire drawing o elementi esistenti.
- [x] 1.2 Mutazioni Master-only versionate e atomiche, proiezione scena attiva, compatibilità documentale e persistenza SQLite.
- [x] 1.3 History muri per scena (40, non persistita), distinta da drawing/live; cancellazione selettiva da elenco e undo/redo.

## 2. Geometria e UI

- [x] 2.1 Disegna muri nella preview Preparazione scena: punti frazionari, gesto simile a matita, bozza annullabile, guida Master ed elenco accessibile; nessun nuovo editing sulla board live.
- [x] 2.2 Intersezioni raggi/polilinee condivise per luce, visione e scurovisione, coordinate mondo con zoom/pan e foto calibrata; non bloccare il movimento implicitamente.
- [x] 2.3 Integrare memoria dell'esplorazione e feather senza rivelazioni da preview o sfumatura, né cancellazioni del terreno già ricordato.

## 3. Verifica

- [x] 3.1 Test Ricalco: due punti, curve/diagonali, coordinate frazionarie, zoom/pan, pointercancel/Escape, cambio scena, edit sfondo pendente e nessuna scrittura fino a conferma.
- [x] 3.2 Test Occlusione: lati opposti, luce/scurovisione, giunzioni/angoli/intersezioni, apertura reale, blockers rettangolari esistenti e movimento invariato.
- [x] 3.3 Test Gestione: cancellazione solo muri, undo/redo isolati e limite 40, legacy, persistenza/reopen e history vuota al restart, negazione Player, stale write e failure atomicity.
- [x] 3.4 Test Scene e memoria: attiva/inattiva, delta ritardati, muro aggiunto su terreno ricordato e nessuna espansione esplorata oltre muro; sfumatura priva di leak.
- [x] 3.5 Verifica manuale su foto reale con Master e due Player, normale/fullscreen, input da tastiera, rimozione e riapertura scena.

## 4. Documentazione e completamento

- [x] 4.1 Aggiornare i contratti Docs/ai elencati nel design insieme al codice; valutare guide utente e router.
- [x] 4.2 npm test, build, docs:check, git diff --check e strict validation dei change interdipendenti; non completare task o archiviare senza verifica.
