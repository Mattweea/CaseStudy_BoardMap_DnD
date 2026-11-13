# Proposal

## Why

La preparazione corrente accosta calibrazione, disegni, muri, elementi, buio, attivazione ed encounter in un unico pannello, con dipendenze di salvataggio poco evidenti. Il Master vuole costruire dungeon a celle oppure partire da un'immagine, verificando luce e aperture prima di portare il party nella scena.

## What Changes

- Organizzare la preparazione in cinque passaggi: Base → Pareti e ambiente → Luci e visuale → Encounter → Riepilogo. Mantenere la mappa visibile durante l'editing e consentire accesso diretto ai passaggi nelle scene esistenti.
- Offrire lo switch «Costruisci da zero / Parti da un'immagine»: cambia gli strumenti inizialmente proposti e conserva immagine, calibrazione, geometria ed encounter. Entrambi i percorsi permettono celle e tracciati.
- Aggiungere pareti strutturali a celle con pennello, rettangolo e gomma. Celle adiacenti appaiono unite, bloccano movimento, luce e visuale e sono indipendenti dai token e dai muri tracciati.
- Conservare Libero/Segmenti e le scorciatoie del change pending `vertex-walls-and-master-darkness`; i tracciati continuano a bloccare luce e visuale senza bloccare il movimento.
- Preparare luci puntuali della scena con aggiunta, spostamento, raggio e rimozione; provare localmente la visuale con un osservatore temporaneo, senza spostare PG o ampliare la memoria esplorata.
- Rendere espliciti salvataggi e bozze nei passaggi. Gli encounter restano facoltativi e molteplici, con definizioni, schede e collocazioni già esistenti.
- Riservare al riepilogo l'attivazione esplicita e il trasferimento opzionale del party. Salvare una scena inattiva resta preparazione privata; confermare modifiche alla scena attiva mantiene la pubblicazione corrente.

## Capabilities

### New Capabilities

- `scene-preparation-wizard`: percorso guidato, switch dei percorsi, navigazione e salvataggi, anteprima locale e riepilogo con attivazione esplicita.

### Modified Capabilities

- `scene-authoring`: pareti strutturali a celle persistenti, strumenti di modifica, resa continua, blocchi condivisi e preparazione delle luci puntuali.

Le capability `scene-management`, `scene-map-presentation`, `encounter-management`, `freehand-vision-walls`, `explored-map-memory` e `multi-scene-session` restano vincoli di compatibilità: questo change aggiunge il percorso guidato senza riscriverne i lifecycle.

## Impact

- Frontend: scomposizione di `SceneCatalogPanel`, nuovi controlli del wizard, editor celle e luci, preview comune, `useSceneCatalog` e API scene. `SceneEncounterSection` e gli editor esistenti vengono riutilizzati.
- Contratti condivisi: campo opzionale retrocompatibile delle pareti a celle nel documento scena e nella proiezione attiva, tipi, normalizzazione, adapter dei bloccanti, rendering Board normale/fullscreen, esplorazione server e validazione del movimento.
- Backend: mutazioni Master-only versionate di celle e luci, persistenza prima della proiezione, snapshot HTTP/SSE limitati alla scena attiva e riconciliazione dei conflitti.
- Persistenza: estensione additiva del documento JSON già salvato in SQLite, senza modificare migrazioni storiche né convertire automaticamente ostacoli-token o tracciati esistenti.
- Documentazione: contratti frontend/backend e delle pareti, guida comandi, eventuali istruzioni del verificatore browser; nessuna nuova dipendenza prevista.
- Sequenza: consolidare e verificare separatamente il pending precedente, poi realizzare il nuovo change in micro commit esplicativi in italiano. Il design e i task definiscono confini e controlli di ciascun commit.

Fuori scope: porte interattive, importazioni esterne, cataloghi di creature, ripristino completo del runtime, modifica delle regole di combattimento, cancellazione delle scene e garanzie ulteriori di segretezza dei payload oltre quelle correnti.
