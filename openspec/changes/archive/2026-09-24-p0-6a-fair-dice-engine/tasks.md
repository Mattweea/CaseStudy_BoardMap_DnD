## 1. Motore condiviso e modelli probabilistici

- [x] 1.1 Implementare in `shared/` il motore ESM dependency-free con dichiarazioni TypeScript, rejection sampling su interi unsigned a 32 bit, porta unica di tiro e adapter di entropia separati; verificare con test focalizzati valori limite, rifiuto della coda, indipendenza delle estrazioni e supporto di d4/d6/d8/d10/d12/d20/d100.
- [x] 1.2 Implementare il risultato per-dado con id opachi, gruppi e disposizioni `kept`/`discarded`/`unresolved`, inclusa la regola di parità per vantaggio/svantaggio e il d100 logico; verificare con test deterministici formule normali, aggregazione, parità, gruppi multipli e coerenza di `rolls`, `keptRolls` e `total`.
- [x] 1.3 Esporre e documentare nel modulo i modelli di `1dS`, `NdS`, vantaggio, svantaggio, successo contro CD e critico; aggiungere la PRNG solo nei test ed eseguire campioni fissi di almeno 200.000 osservazioni con copertura, media, varianza e chi-quadro alle soglie definite nel design.

## 2. Contratti condivisi e compatibilità client

- [x] 2.1 Estendere i tipi condivisi del log con `RolledDie`, `DieDisposition` e `dice`, includendo tutti i dadi dei blocchi di danno; verificare con typecheck/build che i consumatori esistenti continuino a compilare senza dipendere dal nuovo campo.
- [x] 2.2 Aggiornare le normalizzazioni client e server affinché accettino snapshot legacy senza `dice`, conservino una lista nuova soltanto se interamente valida e non sintetizzino semantica storica; verificare con test su snapshot legacy, payload valido e campo `dice` malformato.
- [x] 2.3 Migrare `src/utils/dice.ts` all'algoritmo condiviso mantenendo l'adapter Web Crypto e l'API compatibile per gli usi locali correnti; verificare con i test delle utility e con `npm run build` che non venga importato codice Node nel bundle browser.

## 3. Integrazione autorevole server

- [x] 3.1 Migrare il tiro libero alla porta unica del motore e aggiungere `dice` a risposta e stato senza accettare risultati, identità o seed dal client; verificare con test di integrazione formule normali, vantaggio/svantaggio anche in parità, d100, payload falsificato ed errori di validazione.
- [x] 3.2 Migrare il resolver della scheda alla stessa porta, marcando `unresolved` le coppie d20 e separando i gruppi di danno; verificare con test focalizzati abilità, attacco, critico con dadi raddoppiati, danno multi-parte, dado vita e salvataggio contro morte.
- [x] 3.3 Verificare che side effect, versionamento, rollback e persistenza della scheda restino atomici rispetto al tiro; coprire con test un effetto accettato, una patch rifiutata e una richiesta concorrente/stale senza log o dado fantasma.
- [x] 3.4 Verificare la sanitizzazione per destinatario del nuovo dettaglio in risposte HTTP, snapshot e SSE: un tiro pubblico arriva identico ai client autorizzati e nessun dado di un tiro segreto arriva a un Player non destinatario.

## 4. Documentazione instradata

- [x] 4.1 Aggiornare `Docs/ai/gameplay/combat_movement_and_dice.md` con uniformità, disposizioni e confine fra risultato logico e futura resa 3D, e verificare che i requisiti osservabili restino in OpenSpec senza duplicarne il catalogo.
- [x] 4.2 Aggiornare le foglie backend applicabili (`api_auth_and_realtime.md`, `shared_state_and_persistence.md`, `character_sheet_service_and_realtime.md`) e `frontend_architecture.md` con contratto additivo, compatibilità e adapter runtime; verificare routing e collegamenti con `npm run docs:check`.

## 5. Verifica conclusiva

- [x] 5.1 Eseguire prima i test focalizzati del motore e dei resolver, poi `npm test` e `npm run build`; correggere ogni regressione prima di considerare completati i task correlati.
- [x] 5.2 Eseguire `npm run docs:check`, `git diff --check` e `openspec validate p0-6a-fair-dice-engine --strict --no-interactive`, quindi confrontare implementazione e scenari delle tre delta spec e registrare eventuali verifiche non applicabili con motivazione.
