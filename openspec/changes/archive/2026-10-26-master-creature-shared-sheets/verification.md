# Verifica — master-creature-shared-sheets

Data: 2026-10-26. Branch: `feat/master-creatures-and-dice-workflow`, base `origin/test`.

## Copertura dei requisiti

PG/PNG con editor esistente, mostri con blocco dedicato, propagazione esplicita e stato per istanza.

test/creature-sheets.test.mjs: nove test di gruppo, fork singolo, preview senza scritture, destinatari cambiati, ruoli, tipi, restart, risorse, iniziativa, ritratti, rollback e aritmetica HP server-side. Browser: popup con quattro destinatari, applicazione a tutti, annullamento senza scrittura e Solo questa con fork. NPC: tre tab esistenti e viewport 500×800 senza overflow della finestra. Due Player non ricevono note/eventi privati.

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
