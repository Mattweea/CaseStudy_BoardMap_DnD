# Tasks

## 1. Contratto e backend

- [x] 1.1 Definire schema, limiti e normalizzazione dei tratti.
- [x] 1.2 Implementare operazioni add/erase Master-only con optimistic concurrency.
- [x] 1.3 Testare payload eccessivi, ID stale, autorizzazione e un commit per gesto.

## 2. Frontend

- [x] 2.1 Implementare layer SVG stabile a pan/zoom/fullscreen.
- [x] 2.2 Spostare matita, gomma, colore e spessore nella preview di Preparazione scena con bozza locale, rimuovendoli dalla board live.
- [x] 2.3 Verificare puntatore, tastiera, coordinate e isolamento dai controlli del dialog; confermare che la board live resti di sola lettura.
- [x] 2.4 Integrare nel dialog slider verticale, preview del pennello e picker colore coerente con i controlli esistenti.
- [x] 2.5 Salvare ogni gesto sulla scena selezionata, aggiornare il dettaglio e gestire conflitti e configurazione non salvata.
- [x] 2.6 Verificare che i tratti di una scena inattiva restino privati e quelli della scena attiva vengano proiettati subito.

## 3. Verifica autonoma

- [x] 3.1 Aggiornare i leaf frontend e backend pertinenti ed eseguire npm run docs:check.
- [x] 3.2 Eseguire test mirati, npm run build e git diff --check.
- [x] 3.3 Validare p0-9c-1-drawing in modalità strict.
