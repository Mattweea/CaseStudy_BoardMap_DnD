## Verifica P0.6a

### Evidenze automatiche

- `npm test`: 17/17 file di test passati. La copertura aggiunta verifica rejection sampling ai limiti, d4/d6/d8/d10/d12/d20/d100, aggregati e gruppi, parità di vantaggio/svantaggio, coppie `unresolved`, d100 logico, payload falsificati, normalizzazione legacy/malformata, privacy, side effect accettati/rifiutati/stale e adapter browser.
- La suite statistica deterministica usa almeno 200.000 osservazioni per ciascuna distribuzione richiesta e controlla copertura, media entro cinque errori standard, varianza entro il 2% e chi-quadro con soglia `0,001`.
- `npm run build`: typecheck e bundle Vite completati; il bundle browser usa l'adapter Web Crypto senza dipendenze Node.
- `npm run docs:check`: grafo documentale valido, 22 artefatti raggiungibili.
- `git diff --check`: nessun errore di whitespace.
- `openspec validate p0-6a-fair-dice-engine --strict --no-interactive`: change valida.

### Confronto con le delta spec

- `authoritative-dice-engine`: tutti i tiri passano da `resolveDiceRoll`; il campionamento scarta la coda non uniforme, produce dettaglio per-dado coerente e conserva il primo dado nelle coppie non risolte. I modelli probabilistici richiesti sono funzioni esportate e testate.
- `session-dice-rolling`: il tiro libero usa il motore condiviso, conserva i campi aggregati, aggiunge `dice`, ignora risultati/id/seed proposti dal client e mantiene il filtro completo dei tiri segreti.
- `character-sheet-roll-actions`: coppie d20 `unresolved`, danni `kept` con gruppi distinti, raddoppio critico completo ed effetti collaterali derivati dallo stesso risultato autorevole; un conflitto impedisce la creazione del log.

### Verifiche non applicabili

- Nessuna migrazione database o snapshot è richiesta: il campo è additivo e gli snapshot legacy sono coperti automaticamente.
- Nessuna verifica visuale/WebGL, audio o preferenza è applicabile: rendering 3D e presentazione appartengono alle change successive.
