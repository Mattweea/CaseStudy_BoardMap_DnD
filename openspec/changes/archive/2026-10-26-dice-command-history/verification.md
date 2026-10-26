# Verifica — dice-command-history

Data: 2026-10-26. Branch: `feat/master-creatures-and-dice-workflow`, base `origin/test`.

## Copertura dei requisiti

Richiamo privato dei comandi riusciti, ripristino bozza, editing e invio esplicito.

test/dice-command-input.test.mjs esercita il textarea reale con stato React controllato: IME, selezioni, multilinea, modificatori, pending, errori, richiamo e bozza. test/dice-commands.test.mjs verifica ordine, limite 50 e duplicati. Browser: Invio esegue il tiro e ArrowUp richiama il comando completo.

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
