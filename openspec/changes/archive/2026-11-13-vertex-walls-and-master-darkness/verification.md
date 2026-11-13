# Verifica

Data: 2026-10-26. Schema spec-driven; comportamento concordato con l'utente: selettore Libero/Segmenti al posto delle coordinate numeriche, velo semitrasparente solo al Master, Player con buio opaco.

## Evidenze

- `npm test` con Node 22.22.0: 487 passati, zero falliti/skipped. Include il default opaco, opacità Master esplicita, conservazione dei buchi e feather interno di DarknessLayer, oltre alle regressioni geometriche/movimento precedenti.
- `npm run build`: TypeScript e Vite riusciti; rimane l'avviso preesistente sulla dimensione dei bundle.
- `npm run docs:check`: 23 artefatti raggiungibili; `git diff --check` riuscito.
- `openspec validate vertex-walls-and-master-darkness --strict --no-interactive`: riuscito prima di Apply e dopo l'implementazione.
- `tools/verify-scene-authoring.mjs`, Playwright 1.64.1 e Chromium 156: backend, SQLite e storage temporanei, due contesti browser Master/Player e un contesto touch a 390 px. Nessun riavvio o reset del server di sviluppo.

## Scenari verificati

- Centoventi pointermove fra tre clic producono esattamente tre vertici frazionari e nessuna scrittura prima della conferma; Spazio invia una singola scrittura versionata.
- Coordinate salvate confrontate con il viewBox e confermate anche dopo zoom al 125%. Lo spostamento della preview usa la stessa conversione basata sul rettangolo trasformato.
- Backspace, Escape e cambio Libero/Segmenti scartano o correggono la bozza senza scritture spurie. Libero continua a salvare al rilascio; Frecce/V e Invio consentono il disegno da tastiera, con passo fine di un quarto di cella.
- Una versione modificata da un secondo autore fa rifiutare la conferma con 409 senza aggiungere muri parziali. Il catalogo ricarica la versione corrente.
- Due tocchi e il pulsante di conferma salvano il muro nella vista mobile.
- Il Master ha fill-opacity 0.45, il Player 1; il layer non intercetta puntamento. La luce completa elimina entrambi i layer e il ritorno al buio li ripristina. Il Player non riceve i controlli di preparazione.
- La Board fullscreen mantiene il velo del ruolo. Il suo handler è stato esercitato programmaticamente: il controllo legacy nel relativo header è già nascosto dal CSS del repository, non modificato da questo change.

## Compatibilità e limiti

API, formato dei muri, memoria esplorata e permessi sono invariati; nessuna migrazione né riscrittura dei muri esistenti. Le bozze si azzerano al cambio di scena, modalità o disponibilità dello strumento; le scorciatoie ignorano i campi editabili e i modificatori. Le prove browser sono Chromium desktop/touch, non una matrice esaustiva di browser. Il change rimane applicato e verificato, senza archivio automatico.

## Riconferma prima del consolidamento

2026-11-13: 487 test passati con Node 22.22.0; build, docs:check, validazione strict e verifica browser Chromium desktop/touch riusciti. Playwright installato in /tmp, libreria libasound estratta in /tmp senza modificare il sistema. Nessun server di sviluppo riavviato.
