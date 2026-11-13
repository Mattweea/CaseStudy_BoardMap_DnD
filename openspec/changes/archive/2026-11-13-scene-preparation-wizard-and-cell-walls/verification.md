# Verifica di implementazione

Data: 2026-11-13. Change approvato nella conversazione e implementato in micro commit italiani, dopo il consolidamento separato di `vertex-walls-and-master-darkness`.

## Controlli eseguiti

- `npm test`, Node 22.22.0: **495 test passati, zero falliti, cancellati o saltati**.
- `npm run build`: TypeScript e Vite riusciti. Rimane il consueto avviso Vite sui bundle oltre 500 kB; non impedisce la build.
- `npm run docs:check`: 23 artefatti raggiungibili, controllo riuscito.
- `git diff --check` e controllo del diff in staging: riusciti.
- `openspec validate scene-preparation-wizard-and-cell-walls --strict --no-interactive`: riuscito prima di Apply e a implementazione conclusa; validazione delle capability canoniche ripetuta durante sync/archivio.
- `tools/verify-scene-wizard.mjs`: riuscito con Playwright 1.64.1 / Chromium headless, contesti Master e Adventurer desktop 1440×1000 e contesto touch 390×844. Comprende preparazione, scene inattive, conflitti e transizione.
- `tools/verify-scene-authoring.mjs`: riuscito dopo l'introduzione del wizard; conserva Libero/Segmenti, conferma esplicita, tastiera, coordinate trasformate, conflitti, touch, fullscreen e copertura del buio per ruolo.

Le prove backend/browser usano SQLite, storage e server temporanei. Playwright e la libreria audio mancante sono stati preparati sotto `/tmp`, senza nuove dipendenze del progetto o riavvii del server del Master. Gli screenshot `/tmp/dnd-scene-wizard.png` e `/tmp/dnd-scene-vision.png` sono stati anche ispezionati visivamente. Gli output di build tracciati per ragioni storiche vengono ripristinati senza includerli nei commit di sorgente.

## Confronto con requisiti e scenari

| Capability / requisito | Evidenza |
| --- | --- |
| `scene-preparation-wizard`: Percorso di preparazione navigabile | Browser: accesso diretto ai cinque passaggi, ritorno alla Base, anteprima comune, riepilogo senza encounter e successiva preparazione di due encounter. Nessuna navigazione cambia scena; i controlli non compaiono al Player. |
| Due percorsi di partenza combinabili | Browser: switch ripetuto senza incremento versione; upload immagine e ritorno fra i percorsi conservando celle e sfondo. La prova separata dei tracciati conferma la coesistenza nella stessa preview. |
| Bozze e salvataggi espliciti | Browser: Resta/Scarta, chiusura del dialog con bozza ed Escape, salvataggio prima di proseguire, dimensioni invalide e `409` senza avanzamento. Encounter, definizione della figura e lotto di due placement vengono salvati dal controllo di uscita. Le letture della scena riallineano anche nome/versione del catalogo. |
| Prova locale della visuale | Browser: osservatore spostato da mappa e coordinate, raggio zero, luci in bozza e luce completa; **zero richieste di mutazione**, stessa versione, stessi token e stessa memoria prima/dopo. Escape e cambio passaggio rimuovono il layer. La geometria riusa gli helper condivisi, senza memoria esplorata nel risultato di prova. |
| Riepilogo e attivazione separati | Browser: scena inattiva con luce e parete rimane assente dallo snapshot Player; preview di trasferimento resa obsoleta viene rifiutata senza cambio scena; nuova preview e conferma attivano e trasferiscono il party evitando la cella strutturale. Il blocco durante un round attivo resta coperto dai test scene-routes e multi-scene-session. |
| `scene-authoring`: Pareti strutturali a celle | Test `wall-cells` e browser: pennellata rapida interpolata, rettangolo inclusivo, gomma selettiva, deduplicazione, Escape senza scritture, coordinate da tastiera, zoom 125% e touch. Limite 5000 controllato prima di espandere una selezione eccessiva. |
| Pareti continue e blocchi coerenti | Test scene-blockers, movimento ed esplorazione: muro chiuso, apertura reale, ingombro grande, tracciato indipendente, rifiuto Player atomico, bypass Master/veicolo e memoria conservata dietro nuove pareti. Browser: bordi interni rimossi, HTTP/SSE Master/Player, fullscreen per entrambi e scena densa di 4901 celle resa con due path. |
| Persistenza e isolamento delle pareti a celle | Test modello/routes/repository/projection: default legacy, ordinamento, coordinate e limiti, `401/403/400/409`, idempotenza senza pubblicazioni, errore storage senza cambi, riapertura effettiva di SQLite e proiezione autorevole che sostituisce celle dichiarate dal client. Browser: preparazione inattiva privata e proiezione dopo attivazione. |
| Preparazione delle luci puntuali per scena | Test routes/repository e browser: aggiunta, posizione, raggio, annullamento e rimozione, valori invalidi, conflitto, errore storage, riapertura e isolamento per scena. Digitazione e posizionamento restano locali fino a Salva luci; la scena attiva pubblica solo dopo commit. |

## Compatibilità e limiti

- Documento scena esteso in modo additivo, senza migrazioni SQL o conversioni automatiche di ostacoli-token e tracciati. I default legacy sono verificati.
- Restano invariati l'undo separato dei tracciati/disegni, la memoria monotona del terreno, le eccezioni di movimento Master/veicolo, le schede e le regole di combattimento. L'accesso alla scheda dal placement è stato verificato nel browser.
- Il wizard salva incrementalmente: le modifiche confermate della scena attiva aggiornano subito il gioco; il riepilogo non è una transazione globale di pubblicazione.
- Verifica visuale limitata a Chromium desktop/touch. Firefox, Safari e hardware mobile reale non costituiscono una matrice verificata.
- Il pulsante fullscreen legacy è nascosto dal CSS preesistente: i verificatori esercitano il suo handler programmaticamente. Questa limitazione non nasce dal wizard.
- L'estensione non introduce segretezza aggiuntiva dei payload oltre i contratti correnti e non promette recovery dell'intero runtime.

## Chiusura

Sincronizzati quattro requisiti aggiuntivi in scene-authoring e creata scene-preparation-wizard con cinque requisiti. Validazione strict di tutte le 31 capability canoniche riuscita, nessun errore. Tutti i 25 task risultano completati; change archiviato dopo verifica e confronto integrale dei delta.
