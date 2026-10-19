# Verifica E.5 — 2026-10-19

## Risultato

I percorsi implementati in E.1–E.4 soddisfano la delta di persistenza senza ulteriori modifiche al codice applicativo o allo schema SQLite. La preparazione è salvata nel documento scena; il runtime live rimane separato.

## Confronto con i requisiti

| Scenario della delta | Evidenza |
|---|---|
| Riapertura | `test/encounter-persistence.test.mjs` crea e modifica encounter, mostro, PNG e placement tramite route; chiude SQLite e lo riapre da un processo Node indipendente. Confronta il documento completo e ricostruisce le istanze con ID, nome, HP iniziali, geometria, posizione e hidden persistiti. Una seconda apertura non duplica i token. Le rimozioni restano applicate senza ricreare istanze cancellate dalla preparazione. |
| Stato live escluso | Le route battle-map accettano movimento e modifiche live a HP, condizioni, round, turno e movimento consumato. Il JSON e la versione della scena rimangono identici; la ricostruzione nel nuovo processo riparte dai valori preparati e dai default del combattimento. |
| Commit coerente | Ogni mutazione accettata avanza una sola versione persistita e pubblica una sola volta. Due service su connessioni indipendenti verificano il conflitto 409. Un riferimento orfano è rifiutato senza scrittura. |
| Errore di persistenza | Un trigger SQLite rifiuta una scrittura valida: documento, versione scena, cache, runtime, versione condivisa e numero di broadcast restano invariati. |

Le aperture indipendenti usano database temporanei e gli stessi repository, service, adapter e route dell'applicazione, tramite `app.inject`. Non avviano il listener di produzione o un browser; non costituiscono un test completo di deploy o una verifica UI. Il database della partita corrente non viene usato.

## Confine P0.11

La riapertura recupera definizioni e collocazioni preparate, non l'ultima posizione giocata, HP e condizioni live, ordine/turno/round, movimento consumato o token creati soltanto nel runtime. Il resume esplicito dello snapshot è un meccanismo separato. Il recupero automatico del runtime completo, incluse le scene inattive, resta responsabilità di P0.11.

## Controlli eseguiti

- `node test/encounter-persistence.test.mjs`: 4 scenari passati.
- `npm test`: 336 test passati, nessun fallimento o skip.
- `npm run build`: superato; resta l'avviso Vite sul chunk DiceBox superiore a 500 kB.
- `npm run docs:check`: superato, 22 artefatti raggiungibili.
- `git diff --check`: superato.
- `openspec validate p0-9e-5-encounter-persistence --strict --no-interactive`: superato.
- `openspec validate p0-9e-4-encounter-placement --strict --no-interactive`: superato.

La suite con processi indipendenti è eseguita fuori dalle restrizioni di creazione dei sottoprocessi del sandbox. Nessun test viene saltato per aggirare quel limite.
