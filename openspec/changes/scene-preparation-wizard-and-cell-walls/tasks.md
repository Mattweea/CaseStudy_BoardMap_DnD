# Tasks

Ogni gruppo è un confine di micro commit, con messaggio indicativo in italiano. Un task si completa soltanto dopo la sua verifica. Usare Node 22.22.0 per build/test e la CLI OpenSpec installata con il runtime compatibile. La proposta non equivale a implementazione o verifica del prodotto.

## 1. Consolidare la base precedente

- [x] 1.1 Prima di Apply rileggere gli artefatti approvati e il diff pending; eseguire `openspec validate scene-preparation-wizard-and-cell-walls --strict --no-interactive` e la validazione di `vertex-walls-and-master-darkness`, verificando che i due change non sovrascrivano requisiti reciproci e che gli altri change attivi restino fuori scope.
- [x] 1.2 Verificare la stabilizzazione geometrica pending con i test `explored-regions` ed `exploration-walls`, conservazione della memoria e rifiuto atomico dei movimenti; separarla nel commit «Corregge le unioni della memoria esplorata con pareti dense», includendo la documentazione pertinente e `npm run docs:check`.
- [x] 1.3 Verificare Libero/Segmenti, velo Master e compatibilità Player con `npm test`, `npm run build`, verifica browser isolata e controlli documentali; consolidare nel commit «Aggiunge muri a segmenti e anteprima del buio per il Master», poi sincronizzare e archiviare soltanto `vertex-walls-and-master-darkness` dopo il confronto con i suoi scenari e la validazione strict. Il diff del nuovo change deve restare separato.

## 2. Persistenza e API delle pareti a celle

Commit indicativo: «Salva le pareti a celle nella configurazione versionata delle scene».

- [x] 2.1 Estendere modello, dichiarazioni e cattura/proiezione configurazione con `wallCells` canoniche e limiti del design; aggiungere test in `scene-model` per default legacy, deduplicazione, ordinamento, coordinate, limite celle/documento e conservazione di tracciati e ostacoli esistenti, verificandoli con il runner Node.
- [x] 2.2 Aggiungere mutazione celle Master-only versionata e relativo client/hook, con controllo no-op e persist-before-project; testare aggiunta/rimozione, `401/403/400/409`, no-op, errore storage, riapertura del database e assenza di pubblicazioni parziali nei test scene service/routes/repository.
- [x] 2.3 Documentare schema additivo, endpoint e confine di persistenza nei contratti backend esistenti; verificare `npm run docs:check`, `npm test`, `npm run build` e `git diff --check` prima del commit. Non cambiare migrazioni storiche.

## 3. Blocchi, sincronizzazione e resa delle celle

Commit indicativo: «Integra le pareti a celle in movimento, visuale e board».

- [x] 3.1 Propagare `activeSceneWallCells` attraverso proiezione, normalizzatori, snapshot, reconnect e consumer, impedendo riscritture della configurazione dal full-state commit; verificare Master/Adventurer, scena inattiva privata e una sola pubblicazione attiva nei test active-scene views/projection e realtime.
- [x] 3.2 Integrare le celle nei bloccanti condivisi e in tutti i consumer di movimento, visione, luci, esplorazione e layout placement/trasferimento; aggiungere regressioni per muro chiuso, apertura, coesistenza con tracciati, footprint grandi, eccezioni Master/veicoli, terreno ricordato e fallimenti atomici, eseguendo i test scene-blockers/vision/movement/exploration e multiscena pertinenti.
- [x] 3.3 Introdurre resa comune delle pareti continue sotto i token, senza bordi interni né handler live, in preview e Board normale/fullscreen; verificare celle ortogonali/diagonali, zoom/pan, buio e scena densa in browser isolato, quindi aggiornare contratti frontend/gameplay pertinenti ed eseguire `npm test`, `npm run build`, `npm run docs:check` e `git diff --check`.

## 4. Strumenti di costruzione a celle

Commit indicativo: «Permette di dipingere e cancellare pareti sulla griglia».

- [x] 4.1 Implementare pennello interpolato, rettangolo inclusivo, gomma e bozza del gesto con conversioni della preview esistente; verificare con test geometrici significativi e browser che ogni gesto invii al massimo una mutazione, una pennellata rapida non lasci buchi, i duplicati non crescano e un rettangolo oltre limite sia fermato prima dell'espansione.
- [x] 4.2 Aggiungere controlli da tastiera, cancellazione selettiva e arbitraggio con pan, drawing, elementi, tracciati e placement; verificare Escape, pointercancel, perdita cattura, cambio scena/strumento, zoom/pan e touch, conservando i campi editabili e la singola conferma di Segmenti.
- [x] 4.3 Aggiornare guida comandi e contratto di interazione delle pareti a celle, inclusa la correzione tramite gomma e le history separate; verificare scenari «Pareti strutturali a celle» in browser, `npm run build`, `npm run docs:check` e `git diff --check` prima del commit.

## 5. Luci persistenti della scena

Commit indicativo: «Aggiunge la preparazione delle luci anche nelle scene inattive».

- [ ] 5.1 Estendere PATCH scene, API client e hook con `lightSources` validata e salvataggi versionati; testare CRUD della configurazione, riapertura, raggi invalidi, accessi, conflitti, storage failure e isolamento delle scene, verificando una sola proiezione attiva e conservazione della memoria.
- [ ] 5.2 Introdurre editor luci con posizione/raggio da mappa e tastiera, bozza esplicita, conferma e annullamento; verificare in browser che trascinamento e digitazione non scrivano prima del salvataggio e che una risposta fallita non rappresenti una luce come salvata.
- [ ] 5.3 Aggiornare contratti API/frontend e guida comandi per la preparazione luci; eseguire i test del gruppo, `npm test`, `npm run build`, `npm run docs:check` e `git diff --check` prima del commit.

## 6. Wizard, switch e gestione delle bozze

Commit indicativo: «Organizza la preparazione delle scene in cinque passaggi».

- [ ] 6.1 Estrarre preview comune e contenuti dei cinque passaggi, mantenendo catalogo, editor esistenti e accessi alle schede; implementare switch locale reversibile senza API e selezione iniziale dal background, verificando in browser percorsi vuoto/immagine, uso combinato celle/tracciati e conservazione di tutti i layer dopo gli switch.
- [ ] 6.2 Implementare navigazione accessibile, salto degli encounter, accesso diretto alle scene esistenti e un solo strumento attivo; verificare tastiera, focus, viewport stretto, gestione di più encounter, batch, placement e coerenza della preview dopo cambio passaggio.
- [ ] 6.3 Unificare controllo di uscita dirty, Salva e continua, scarto, permanenza e annullamento gesti anche nella chiusura del dialog padre; verificare errori di salvataggio, `409`, doppie conferme, cambio scena con risposta tardiva e riapertura, assicurando nessun avanzamento o sovrascrittura obsoleta.
- [ ] 6.4 Aggiornare architettura frontend e contratto delle bozze; eseguire la verifica browser dei requisiti «Percorso di preparazione navigabile», «Due percorsi di partenza combinabili» e «Bozze e salvataggi espliciti», più `npm run build`, `npm run docs:check` e `git diff --check` prima del commit.

## 7. Prova della visuale e riepilogo

Commit indicativo: «Aggiunge la prova della visuale e il riepilogo prima dell'attivazione».

- [ ] 7.1 Aggiungere osservatore locale e raggio con geometria condivisa, escludendo memoria esplorata e ogni mutazione/evento di gioco; verificare muri a celle/tracciati, apertura, buio, luci in bozza, pan/zoom e uscita dalla prova, confrontando richieste di rete, token e memoria prima/dopo la prova.
- [ ] 7.2 Spostare attivazione e trasferimento nel riepilogo con collegamenti ai passaggi e stato attiva/inattiva; verificare scena senza encounter, scena con più encounter, preparazione privata, aggiornamento immediato di modifiche confermate sulla scena attiva, conflitto della preview di trasferimento e round attivo senza effetti parziali.
- [ ] 7.3 Documentare confini della prova locale e attivazione nei contratti frontend e guida comandi; aggiornare il verificatore browser e le sue istruzioni operative se necessarie, verificando `npm run build`, `npm run docs:check` e `git diff --check` prima del commit.

## 8. Verifica integrata e archivio

Commit indicativo: «Verifica e archivia il wizard di preparazione e le pareti a celle».

- [ ] 8.1 Eseguire `npm test`, `npm run build`, `npm run docs:check`, `git diff --check` e `openspec validate scene-preparation-wizard-and-cell-walls --strict --no-interactive`; confrontare esplicitamente ogni requisito e scenario delle due delta spec con evidenze automatizzate/browser reali, registrando risultati e limiti in `verification.md`.
- [ ] 8.2 Eseguire verifica integrata browser Master/Adventurer desktop/touch con database e storage temporanei: entrambi i percorsi, celle unite e aperture, tracciati e disegni, luci, osservatore senza mutazioni, più encounter/schede/placement, salvataggi/conflitti, transizioni, fullscreen e assenza del wizard Player. Documentare eventuali scenari non eseguibili e non dichiararli verificati.
- [ ] 8.3 Dopo tutti i task e la verifica riusciti, sincronizzare i soli delta implementati nelle capability canoniche e archiviare il change secondo la skill prevista; verificare validazione strict delle spec interessate, `npm run docs:check`, `git diff --check` e stato Git coerente, senza includere runtime o modifiche estranee nei commit.
