## Context

La matita usa già punti frazionari in coordinate di cella nella preview del dialog Preparazione scena, una scrittura versionata al rilascio e Escape per annullare. I blockers esistenti sono rettangoli derivati da elementi/token: convertirvi un muro diagonale come unico rettangolo bloccherebbe un'intera stanza.

## Goals / Non-Goals

Ricalcare liberamente i muri della foto e ottenere occlusione reale di luce/visuale. Non inferire muri dai pixel, non creare token/HP/condizioni, non aggiungere porte, finestre o collisioni di movimento implicite. La board live conserva il flusso di sola visualizzazione della scena.

## Decisions

1. Aggiungere modalità esclusiva Disegna muri alla preview, accanto a matita/gomma/pan. Riutilizzare conversione puntatore→coordinate mondo, pointer capture, preview del gesto ed Escape. Punti frazionari: non arrotondare alle celle del token. Gestione accessibile tramite elenco dei tratti e comandi di selezione/cancellazione; alternativa per inserire punti di un segmento da tastiera.
2. Layer walls con ID stabili e polilinee in coordinate della scena. I segmenti sono occlusori bidirezionali: lo spessore/colorazione del pennello è soltanto una guida del Master. Non stampare i tratti sulla foto e non mostrare guide di editing ai Player. L'immagine resta gestita dal workflow esistente. Pan/zoom non muovono il layer; modifiche successive di calibrazione dello sfondo spostano soltanto l'immagine, come per il drawing esistente, e non riscrivono silenziosamente i muri.
3. Un gesto concluso invia una sola mutazione versionata per la scena selezionata. Preview senza scritture; Escape/pointercancel/cambio scena annullano la bozza. Impedire il tracciamento con modifiche non salvate a sfondo, calibrazione o dimensioni, come per la matita. Due punti distinti sono il minimo; duplicati consecutivi normalizzati, numeri finiti e limiti di coordinate/numero punti/dimensione documento validati server-side. Semplificare solo con tolleranza che non apra varchi o tagli angoli.
4. Integrare segmenti direttamente nei calcoli di intersezione raggi: raggi contro segmenti, estremi e giunzioni con tolleranza numerica coerente. Nessuna conversione in bounding box rettangolare o intere celle. Una giunzione chiusa non lascia fessure numeriche; una vera apertura non disegnata resta un passaggio visivo. Contributi di più muri e blockers esistenti si combinano senza sostituirsi. Scurovisione non attraversa i muri.
5. Riutilizzare la stessa geometria per la visuale corrente client e il calcolo autorevole della memoria proposto in persistent-explored-map. Il muro confermato impedisce nuove rivelazioni oltre di sé; la sfumatura rimane confinata al lato consentito. Un muro aggiunto successivamente non cancella regioni già esplorate: il terreno può restare ricordato, ma non offre visuale live oltre la barriera.
6. Solo Master per aggiunta/rimozione/undo/redo. Rimozione selettiva del tratto mediante gomma muri o elenco, senza cancellare disegni decorativi. History muri separata da history drawing e undo live, per scena e non persistita, limite 40 coerente col progetto. Riutilizzare infrastruttura command/history dove applicabile senza cambiare il significato delle route drawing esistenti.
7. walls default [] per scene legacy, persistito nel documento SQLite versionato. Valutare se aggiungere un campo compatibile nella versione corrente o introdurre migrazione documentale secondo la policy esistente; non riscrivere migrazioni applicate. Un errore di validazione, versione o persistenza lascia documento, proiezione e runtime invariati; 409 permette riconciliazione senza duplicare tratti al retry.
8. Scene attiva: installare nuova proiezione e ricalcolare visione una sola volta dopo commit. Scena inattiva: solo preparazione privata; nessun dato inattivo ai Player. Una geometria minima della scena attiva può essere necessaria al renderer corrente, senza guide Master; non affermare per questo change che tutto il payload oltre il fog è segreto (confine P0.10).

## Risks

Campionamento/smoothing del tratto può creare microfessure; testare angoli e intersezioni. Coordinate intere inappropriate impedirebbero il ricalco della foto. Molti punti richiedono indice spaziale o prefiltraggio, evitando di moltiplicare i raggi per tutti i tratti a ogni frame. Tolleranze di giunzione non devono chiudere una vera apertura.

## Documentation impact

Durante Apply aggiornare Docs/ai frontend (strumenti e visibilità), backend (schema, routes, proiezione e history), gameplay (blockers distinti da movimento), database (evoluzione documento), operations se cambia lifecycle. Aggiornare i router soltanto se vengono aggiunte nuove foglie; non duplicare requisiti OpenSpec in Docs/ai.

## Verification

Master e due Player: importare/calibrare foto usando il flusso esistente, tracciare corridoio e stanza, verificare fonti da entrambi i lati, scurovisione, apertura reale, diagonalità/curve e giunzioni. Test autorizzazione, CAS, SQLite failure, history, scena inattiva, reopen/legacy; combinare con memoria e feather. Build, npm test, docs:check e strict validation prima del completamento.
