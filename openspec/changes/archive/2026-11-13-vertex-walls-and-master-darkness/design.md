# Design

## Context

Vedi proposal.md. SceneWallEditor oggi registra i pointermove e salva al rilascio; dispone anche di un form numerico. Board riceve già canManageTokens, isBoardFullyLit ed exploredRegions; soltanto il Player riceve una sorgente vision. Il server aggiorna la memoria prima di pubblicare le mutazioni e quando si attiva il buio.

## Goals / Non-Goals

Le scelte di interazione e la distinzione Master/Player sono state confermate dall'utente nella conversazione. Conservare geometria frazionaria, API e muro persistito; non semplificare o riscrivere i muri già salvati e non modificare il buio opaco Player.

## Decisions

- Stato locale per modalità, vertici, puntatore e gesto; default Segmenti per evitare campionamento involontario. Libero conserva il rilascio come conferma; Segmenti usa un comando esplicito. Non riusare il motore di movimento, che impone celle e costi: riusare il comportamento di puntamento e le trasformazioni della preview.
- Scorciatoie attive solo nello strumento e fuori dai campi editabili; conferma touch accessibile tramite pulsante. Cambi di contesto invalidano la bozza prima di qualsiasi salvataggio.
- Per conservare l'accesso da tastiera dopo la rimozione del form, l'overlay focalizzato usa Frecce per spostare il cursore (Shift: un quarto di cella) e V per aggiungere il vertice, con le stesse conferme della modalità Segmenti.
- La verifica ripetibile delle interazioni usa `tools/verify-scene-authoring.mjs` con Playwright opzionale esterno al progetto, backend e storage temporanei. I test Node del layer garantiscono il default opaco e la semitrasparenza esplicita.
- Board Master rende la memoria autorevole della scena come aperture del velo. Questa memoria include la visione legittima corrente dopo il commit; evita un secondo calcolo client di tutti i PG. DarknessLayer riceve opacità esplicita per Master, mentre il default Player resta 1. Il velo rimane pointer-transparent.
- Nessuna modifica a shared state, autorizzazione, database o backend. Il nuovo comportamento è locale alla presentazione e al gesto di authoring.

## Risks / Trade-offs

- Scorciatoie globali della scena → consumare soltanto i tasti dello strumento attivo, rispettando input e modificatori.
- Render normale/fullscreen divergente → stessa Board e stesso DarknessLayer, verificati per entrambi i ruoli.
- Browser non disponibile → predisporre verifiche di interazione isolate oltre ai test automatici, senza usare i dati di sviluppo.

## Migration Plan

Nessuna migrazione: le spezzate usano il formato muri corrente. Il rollback del frontend conserva tutti i muri persistiti. Il change resta aperto dopo Apply, senza archivio automatico.
