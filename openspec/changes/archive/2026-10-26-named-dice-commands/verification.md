# Verifica — named-dice-commands

Data: 2026-10-26. Branch: `feat/master-creatures-and-dice-workflow`, base `origin/test`.

## Copertura dei requisiti

Nome distinto da formula, validazione senza effetti collaterali, privacy e compatibilità.

test/dice-commands.test.mjs e test/authoritative-roll.test.mjs: parser, escape, Unicode, limiti, API diretta, autore server e visibilità. Browser: /r 1d12+5 -n "attacco con ascia" conserva nome e formula nel log e nella cronologia. Rendering React come testo.

## Controlli comuni

- Installazione pulita `npm ci` con Node 22.22.0: riuscita; migrazioni additive applicate senza reset.
- Suite completa: 481 test passati, 0 falliti, 0 skipped. Comando: `npm test` con il runtime di `.nvmrc` attivo.
- Build TypeScript/Vite: riuscita; resta l'avviso sulle dimensioni dei bundle già presenti nel progetto.
- `npm run docs:check`: riuscito, 23 artefatti raggiungibili. `git diff --check`: riuscito.
- Validazione strict del change: riuscita prima di Archive.
- Backend e proxy Vite del checkout attuale avviati e verificati con health check e risposta del frontend.

## Metodo e limiti

Verifiche browser eseguite su applicazione e database temporanei isolati; nessun dato di sviluppo eliminato. Le combinazioni geometriche e di interazione sono coperte dai test automatici insieme a scenari browser rappresentativi desktop/mobile, senza dichiarare una matrice manuale esaustiva. La visibilità non costituisce implementazione completa del futuro confine P0.10.

La validazione OpenSpec globale strict segnala 16 elementi non validi già presenti in `origin/test`: stesso elenco verificato su un'estrazione pulita della base. Nessuno di questi change preesistenti è stato archiviato o corretto incidentalmente.
