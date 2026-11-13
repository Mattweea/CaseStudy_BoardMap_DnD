# Tasks

## 1. Disegno muri

- [x] 1.1 Sostituire il form numerico con Libero/Segmenti e implementare clic, anteprima, conferma e annullamento; verificare che pointermove non aggiunga vertici in Segmenti e che Libero conservi il gesto.
- [x] 1.2 Verificare coordinate frazionarie, reset di bozza, scorciatoie fuori dagli input e singola scrittura versionata con test e interazioni isolate; aggiornare la guida comandi e il contratto frontend.

## 2. Velo Master

- [x] 2.1 Rendere il terreno sconosciuto semitrasparente al 45% soltanto per Master, riusando memoria autorevole e layer comune; verificare markup/opacità, buio opaco Player, luce completa e fullscreen con test e prova isolata.
- [x] 2.2 Aggiornare il contratto frontend e verificare il grafo con npm run docs:check.

## 3. Verifica integrata

- [x] 3.1 Eseguire npm test, npm run build, git diff --check e openspec validate vertex-walls-and-master-darkness --strict --no-interactive; confrontare gli scenari implementati con le due delta spec e registrare evidenze e limiti.
