## 1. Geometria della camera

- [x] 1.1 Implementare una utility client pura per la minima correzione della camera usando viewport reale, zoom effettivo e ingombro; verificare con `node --test` quattro bordi, nessuna correzione per token interamente visibile, celle parziali, ingombri grandi, board finite e illimitate e raggiungibilità dell'ultima cella senza usare l'overscan.
- [x] 1.2 Risolvere in `App` il PG seguito per ruolo e passarlo a entrambe le Board; verificare Player canonico, Master con un solo PG selezionato, esclusione familiari/nemici e assenza del bersaglio nella scena.

## 2. Movimento e interazioni

- [x] 2.1 Integrare il seguito nel percorso di camminata confermata e nella posizione interpolata, incluso l'offset del PG trasportato; verificare avanzamento su più bordi senza salto anticipato alla destinazione e testare che preview, aggiornamenti ottimistici e rifiuti non spostino la camera.
- [x] 2.2 Rendere la localizzazione esplicita consumabile per nonce e conservare il pan manuale a PG fermo; verificare che un aggiornamento HP o il movimento di un altro token non ricentrino la vista dopo una localizzazione.
- [x] 2.3 Integrare reset e deduplicazione con il lifecycle della scena e del bersaglio; verificare cambio scena, rimozione/sostituzione del PG, eventi vecchi, riconnessione e movimenti simultanei senza contesa della camera.

## 3. Verifica integrata e documentazione

- [x] 3.1 Eseguire e registrare una prova UI con Master e due Player su board finita e illimitata: frecce/pad e percorso confermato, quattro bordi, PG in veicolo, zoom diversi, pannello aperto/chiuso e fullscreen; verificare camere locali e zoom orizzontale preservato. Usare verifica browser manuale perché il progetto non dispone di un runner E2E; registrare evidenze o l'eventuale limite prima di chiudere il task.
- [x] 3.2 Aggiornare `Docs/ai/frontend/board_interaction_and_visibility.md` con il contratto riutilizzabile di seguito, viewport e localizzazione; verificare `npm run docs:check` e `git diff --check`.
- [x] 3.3 Eseguire i test client mirati e `npm run build`, confrontare tutti gli scenari della delta con evidenze automatiche/manuali e validare `openspec validate follow-player-movement-camera --strict --no-interactive`; eseguire anche `npm test` se l'implementazione tocca helper condivisi o il lifecycle delle mutazioni.
