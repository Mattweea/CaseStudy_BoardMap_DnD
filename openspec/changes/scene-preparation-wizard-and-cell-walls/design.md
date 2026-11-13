# Design

## Context

Vedi `proposal.md` per motivazione e perimetro. Classificazione: frontend, feature backend/realtime, gameplay e aggiornamento documentazione; l'estensione del documento persistito richiede anche la consultazione del contratto database.

Il catalogo corrente concentra in `SceneCatalogPanel` bozza di nome/sfondo/calibrazione/dimensioni/buio, preview trasformata, disegni, `SceneWallEditor`, elementi e attivazione. `SceneEncounterSection` gestisce encounter, definizioni e placement con API proprie; `useSceneCatalog` mantiene selezione e scritture versionate. Una bozza della configurazione disabilita gli strumenti che richiedono una base salvata. Luci e ostacoli-token live sono già supportati, ma mancano un editor delle luci per una scena inattiva e un layer strutturale di celle.

`shared/scene-model.mjs` normalizza il documento versione 1 e lo salva come JSON in SQLite; `server/active-scene-projection.mjs` installa la configurazione attiva. `shared/scene-blockers.mjs` alimenta movimento, visione ed esplorazione tramite ingombri rettangolari e tracciati. Il Master e i veicoli hanno eccezioni di movimento da preservare. Il pending `vertex-walls-and-master-darkness` aggiunge Libero/Segmenti e il velo Master; contiene inoltre la stabilizzazione della geometria esplorata. I due change non devono riscrivere gli stessi requisiti.

## Goals / Non-Goals

**Goals:** mantenere un solo documento scena e una sola geometria condivisa; distinguere stato salvato, bozze e prova visiva; estendere i percorsi esistenti senza generare un secondo modello di token o encounter. Spezzare il lavoro in commit verificabili e reversibili con messaggi italiani.

**Non-Goals:** transazione unica dell'intero wizard, nuovo stato persistito «pubblicata/pronta», autosalvataggio dei campi, nuove eccezioni di movimento, importazione degli ostacoli-token nel layer celle, editor di porte, reset della memoria o modifica delle capability delle schede.

## Decisions

### 1. Un editor con cinque passaggi e una preview condivisa

Scomporre `SceneCatalogPanel` in contenitore del catalogo, navigazione e contenuti dei passaggi. Estrarre il contenitore della preview corrente conservando le trasformazioni world/screen e gli host dei portal. La mappa resta centrale; cambia la sezione strumenti attiva. Riutilizzare gli editor disegni, muri, elementi ed encounter, compresi accessi alle schede e batch di creature. Mantenere le bozze dei campi nel proprietario del wizard e arbitrare un solo strumento attivo fra pan, drawing, tracciati, celle, luci, osservatore e placement. Cambio passaggio annulla i gesti incompleti.

La navigazione è una sequenza accessibile con nome e passaggio corrente, pulsanti Indietro/Continua e accesso diretto. A viewport stretta anteprima e controlli si dispongono verticalmente, mantenendo accessibili navigazione e salvataggi. Evitare cinque dialog indipendenti: duplicano preview, focus e stato. Evitare una riscrittura di Board nell'editor: introdurrebbe interazioni live non richieste.

### 2. Lo switch orienta gli strumenti, non modifica i dati

`from-scratch` e `from-image` sono stato UI locale della preparazione. Alla prima apertura proporre il percorso coerente con il background salvato. Lo switch conserva lo sfondo eventualmente presente; la scelta da zero rende prioritari gli strumenti celle e non rimuove automaticamente l'immagine. Rimozione e sostituzione restano comandi espliciti della Base. Nessun campo di modalità nel documento condiviso e nessuna richiesta API per il solo switch.

### 3. Salvataggi incrementali con confini visibili

Base usa una bozza con Salva e continua o Salva; strumenti a gesto conservano una sola scrittura alla loro conferma, compreso il rilascio del pennello/rect e la conferma esplicita di Segmenti. Luci hanno una bozza selezionata e una conferma esplicita; il trascinamento aggiorna la bozza e non invia richieste per pointermove. Una bozza luce impedisce selezioni o scritture che ne invaliderebbero silenziosamente la base.

Un unico controllo di uscita gestisce cambio passaggio, cambio scena e chiusura con campi dirty: salva e prosegui, scarta e prosegui, resta. La chiusura del dialog esterno deve passare dallo stesso controllo. Conflitti e errori bloccano l'avanzamento e usano la riconciliazione di `useSceneCatalog`; un risultato tardivo di una scena diversa non deve sostituire quella appena selezionata. Stato di salvataggio, motivo del rifiuto e focus devono restare comprensibili anche da tastiera.

Il riepilogo riassume dati già salvati e ospita i comandi di attivazione/trasferimento esistenti. Non promette un commit globale finale: le modifiche della scena attiva continuano a essere distribuite dopo ciascun commit, come oggi. Un'alternativa di pubblicazione differita richiederebbe un modello di bozza server distinto e resta fuori scope.

### 4. Celle strutturali separate da token, elementi e tracciati

Aggiungere `wallCells: { x: number; y: number }[]` al documento scena versione 1, default `[]`, con tipi runtime-neutral. Conservare solo coordinate intere non negative, senza ID per cella, deduplicate e ordinate per riga/colonna. Rispettare coordinate massime, board finita e limite documentale corrente di 2 MiB; introdurre un limite di 5000 celle strutturali per scena, coerente con il limite corrente delle collezioni. Una richiesta con celle duplicate viene canonicalizzata; coordinate malformate o un risultato oltre limite fanno fallire l'intero comando.

Pennello e gomma producono insiemi di coordinate; l'interpolazione su griglia riempie le celle attraversate, mentre il rettangolo riempie l'area inclusiva fra estremi. La preview controlla il limite prima di espandere rettangoli grandi. Aggiunta/rimozione di celle già presenti/assenti è idempotente: un risultato identico non incrementa versioni e non trasmette eventi. Escape, pointercancel, perdita della cattura e cambio contesto scartano il gesto incompleto. Controlli con colonna/riga e rettangolo offrono l'equivalente da tastiera.

La continuità è derivata dall'adiacenza ortogonale e resa eliminando i bordi interni; non servono gruppi persistiti. Diagonali a contatto per un vertice restano celle distinte. Pennello, rettangolo e gomma bastano per questa iterazione; la cancellazione selettiva crea aperture. Non introdurre token oggetto per cella: li renderebbe selezionabili e spostabili come oggetti live e mescolerebbe struttura e runtime. Non convertire i tracciati in celle: perderebbe precisione su foto e diagonali. Non aggiungere una nuova history: le celle non entrano nelle cronologie di drawing, muri tracciati o live; la gomma resta il comando di correzione della nuova geometria.

### 5. Mutazioni autorevoli e integrazione dei bloccanti

Introdurre `POST /api/scenes/:id/wall-cells` con `{ baseVersion, operation: 'add' | 'remove', cells }`, Master-only, risposta dettaglio scena. Normalizzazione e validazione avvengono prima del persist; il servizio usa `versionedScene` e `updateScene`. Applicare il normale limite del body prima di espandere la geometria. No-op dopo il controllo della versione; errore `400` per input/limiti, `401/403` per accesso, `409` con scena corrente per conflitto.

Proiettare soltanto le celle della scena attiva in `activeSceneWallCells`, default `[]` in entrambi i normalizzatori e negli snapshot legacy. La proiezione è autorevole: una sostituzione generica del live state non può riscrivere la configurazione strutturale. Estendere l'adapter condiviso con celle 1×1 e aggiornare tutti i chiamanti di movimento, visione, luci ed esplorazione, inclusi controlli di placement/trasferimento. Il rendering delle pareti si colloca sopra lo sfondo e sotto i token e usa la stessa rappresentazione nella preview e in Board normale/fullscreen.

Preservare il persist-before-project e l'esplorazione autorevole correnti. Nessuna espansione di memoria dalla preview o da una mutazione fallita. Le celle entrano nei medesimi bloccanti rettangolari degli ostacoli esistenti: si conserva la tolleranza geometrica già adottata, senza promettere un nuovo motore di ray-casting. I tracciati conservano API, formato, history e semantica.

### 6. Luci di preparazione e osservatore effimero

Estendere la PATCH scene con `lightSources`, validata tramite il normalizzatore esistente e salvata in `document.board.lightSources`. API client e `useSceneCatalog` inviano una configurazione confermata con la versione corrente; aggiungere/spostare/ridimensionare/rimuovere una luce non passa dal commit completo dello stato live. Conservare coordinate e raggi supportati dalle luci esistenti, senza introdurre vincoli incompatibili sui documenti precedenti.

La prova usa `visibleRegions` e i bloccanti condivisi, con un osservatore sintetico locale di una cella e raggio regolabile. La posizione è quella della cella indicata; il raggio iniziale è 12 celle e può essere zero. Il buio e le luci correnti sono rappresentati secondo la bozza del passaggio. La memoria esplorata persistita resta esclusa dal risultato di prova, indicato come «Visuale di prova», così si distinguono vista attuale e terreno ricordato. Uscire dalla prova o cambiare scena rimuove l'osservatore. Nessuna API, evento walk o chiamata al servizio esplorazione per spostarlo. L'alternativa di spostare un PG temporaneamente è esclusa perché genererebbe movimento e memoria reali.

### 7. Dipendenze e micro commit

Il pending precedente rimane separato. Prima di modificare i suoi stessi file in Apply: verificare lo stato effettivo con Node 22, consolidare in commit distinti la stabilizzazione geometrica e gli strumenti/velo, confrontare scenari e archiviare `vertex-walls-and-master-darkness` con sync soltanto dopo verifiche riuscite. Gli altri change attivi `local-board-light-toggle` e `local-compact-token-hp` non vengono archiviati o riscritti da questo lavoro; i loro comportamenti e i toggle esistenti restano compatibili.

Il primo commit del nuovo change contiene soltanto questi artefatti. Le fasi successive sono: modello e API celle; integrazione e rendering dei bloccanti; strumenti celle; persistenza luci; wizard e switch; preview visiva/riepilogo; verifica, documentazione e archivio. Ciascun commit deve superare i controlli pertinenti e lasciare il progetto compilabile. Evitare un commit per singolo file quando produrrebbe un contratto incompleto.

## Risks / Trade-offs

- Nuovo campo condiviso → inventario dei chiamanti, test di normalizzazione legacy, snapshot e reconnect per Master/Adventurer prima di introdurre l'editor.
- Crescita delle celle e costo di vision/render → limite 5000, insiemi deduplicati, operazioni sul solo viewport per la resa e geometria memoizzata indipendente da camera/zoom; verificare una scena densa.
- Gesti sovrapposti e conversioni sbagliate → un solo strumento attivo e preview comune, prove con zoom/pan, touch, diagonali e input da tastiera.
- Editor salvati e preview con bozze differenti → indicatore bozza unico e blocco delle operazioni che richiedono base confermata; niente autosalvataggi in navigazione.
- Nuove pareti sovrapposte a figure già collocate → non spostare o rimuovere automaticamente figure; conservare la possibilità di uscire da un blocco secondo la regola corrente e validare i nuovi placement con i nuovi bloccanti.
- Rollback a un binario ignaro del nuovo campo → backup prima del rilascio e ripristino applicazione/dati insieme; un vecchio normalizzatore potrebbe eliminare campi sconosciuti durante un successivo salvataggio.

## Migration Plan

1. Concludere review degli artefatti e validazione strict prima di Apply.
2. Consolidare il pending precedente in commit separati e sincronizzarne soltanto i delta verificati.
3. Introdurre normalizzazione additiva, API e proiezione prima dei controlli UI; nessuna migrazione SQL o riscrittura massiva. Scene senza `wallCells` usano `[]`; luci e tracciati esistenti si conservano.
4. Realizzare le fasi dei task con test proporzionati; usare database/storage temporanei per prove backend e browser, senza riavviare il server del Master.
5. Verificare requisiti/scenari, registrare evidenze reali e limiti, sincronizzare e archiviare il nuovo change soltanto a lavoro concluso. Effettuare backup dati prima di qualsiasi rollback operativo; non toccare migrazioni storiche.
