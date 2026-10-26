## 1. Contratti e geometria

- [x] 1.1 Confermare in review il default di memoria comune del party e terreno distinto da creature; verificare compatibilità con opaque-map-darkness e le regole attuali di visione.
- [x] 1.2 Estrarre/riusare geometria deterministica, definire formato sparso, unione e revisione per scena, rispettando muri, bordi e coordinate mondo.
- [x] 1.3 Test requisiti Esplorazione e Separazione: raggio/scurovisione, luce, ostacoli, angoli parzialmente visibili, ritorno lungo corridoio, nessun contributo da nemici o vista Master.

## 2. Stato autorevole e durabilità

- [x] 2.1 Migrazione additiva e repository SQLite per memoria campagna/scena con valori legacy vuoti; non modificare migrazioni applicate o confine runtime/snapshot.
- [x] 2.2 Accumulare sui percorsi confermati (compresi punti intermedi), login/attivazione e variazioni pertinenti di visione, includendo PG trasportati; escludere preview, mosse rifiutate e traiettorie inventate per teletrasporto.
- [x] 2.3 Coordinare persistenza e commit movimento/versione/SSE prima della conferma; unire contributi concorrenti e preservare memoria durante undo/restore.
- [x] 2.4 Test requisiti Autorevolezza e Durabilità: due contributi simultanei, errore SQLite senza effetti parziali, migrazione/rollback/reapply, reconnect/riavvio e vecchio snapshot.

## 3. Realtime e presentazione

- [x] 3.1 Integrare HTTP/SSE con sceneId e revisione, recupero completo alla riconnessione e scarto delta di scene inattive; bloccare sostituzioni client arbitrarie.
- [x] 3.2 Rendere il terreno esplorato sempre visibile, mantenendo nero pieno su sconosciuto e separando i token dinamici dalla maschera della memoria.
- [x] 3.3 Test requisiti Isolamento e Separazione: due scene, A→B→A, delta duplicati/ritardati, altro Player, memoria non persa dal toggle luce completa, nemico che entra/esce dalla zona ricordata.
- [x] 3.4 Verifica manuale del corridoio con Master e due Player, zoom/pan/fullscreen, immagine ad alto contrasto e board illimitata. Accertare assenza di nuovi dettagli visibili oltre gli ostacoli; il test non dichiara risolta tutta la P0.10.

## 4. Documentazione e completamento

- [x] 4.1 Aggiornare i contratti Docs/ai individuati nel design insieme all'implementazione e i relativi router se necessari; non pubblicare comportamento futuro come corrente durante Propose.
- [x] 4.2 Eseguire npm test, build, docs:check, git diff --check e openspec validate persistent-explored-map --strict --no-interactive.
- [x] 4.3 Verificare scenari e regressioni prima di segnare i task; sincronizzare canonici e archiviare soltanto dopo applicazione e verifica.
