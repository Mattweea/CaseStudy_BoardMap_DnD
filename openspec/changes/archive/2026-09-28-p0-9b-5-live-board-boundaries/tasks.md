# Tasks

## 1. Contratto dimensionale e persistenza

- [x] 1.1 Aggiornare normalizzazione e validazione di scene, snapshot e tipi condivisi per accettare solo dimensioni positive valide o `0 × 0`; verificare con test coppie finite, zero e miste.
- [x] 1.2 Adeguare la mutazione versionata delle dimensioni e la persistenza alla modalità illimitata, mantenendo autorizzazione e conflitti; verificare con `npm test` e test di riavvio/snapshot legacy.
- [x] 1.3 Valutare e aggiornare i contratti riusabili in `Docs/ai` relativi alle dimensioni, se necessario; verificare con `npm run docs:check` e `git diff --check`.

## 2. Preview del dialog

- [x] 2.1 Collegare dimensioni in bozza, immagine e calibrazione alla preview live, mostrando confine e area esclusa o assenza di taglio per `0 × 0`; verificare manualmente modifiche senza salvataggio e annullamento.
- [x] 2.2 Correggere il layout della preview affinché la scala sia identica sui due assi a ogni larghezza/altezza disponibile; verificare celle quadrate con dimensioni e viewport diversi e con `npm run build`.
- [x] 2.3 Documentare in `Docs/ai` soltanto le eventuali nuove invarianti riusabili della preview e verificare con `npm run docs:check`, se la documentazione cambia.

## 3. Board e interazioni illimitate

- [x] 3.1 Renderizzare una finestra virtuale della griglia in base alla camera e svincolare il pan dal bordo positivo per `0 × 0`, conservando origine, immagine calibrata e comportamento finito; verificare pan/zoom oltre l'asset e regressione sulla board finita con `npm run build`.
- [x] 3.2 Adeguare controlli client/server di coordinate, movimento, righello e sagome senza eliminare autorizzazione, collisioni o budget; introdurre un limite tecnico di elaborazione e verificare con `npm test` casi oltre il vecchio bordo, negativi e percorsi eccessivi.
- [x] 3.3 Aggiornare eventuali contratti geometrici riusabili in `Docs/ai` e verificare con `npm run docs:check` e `git diff --check`.

## 4. Verifica integrata

- [x] 4.1 Eseguire `npm run build`, `npm test`, `npm run docs:check` se la documentazione è cambiata e `openspec validate p0-9b-5-live-board-boundaries --strict --no-interactive`; registrare risultati e controllare il diff.
- [x] 4.2 Provare in UI con Master e Player il passaggio finita → illimitata → finita, la preview live e quadrata, salvataggio/annullamento, sincronizzazione e movimento oltre il vecchio confine; riportare eventuali limiti di verifica manuale.
