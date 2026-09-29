# Tasks

## 1. Contratto scene e server

- [ ] 1.1 Estendere la patch Master-only della scena con il booleano `isFullyLit`, preservare gli altri campi `board` e verificare con test route i casi valido, payload non valido, 401/403 e conflitto `409`.
- [ ] 1.2 Persistire la modifica prima della proiezione, trasmettere un solo snapshot se la scena è attiva e nessuno se è inattiva; verificare con test server/service persistenza, fallimento, versione condivisa e attivazione successiva.
- [ ] 1.3 Confermare tramite test di normalizzazione/proiezione che scene legacy senza il campo mantengano il buio attivo e che la configurazione selezionata raggiunga entrambi i ruoli.
- [ ] 1.4 Aggiornare i contratti riusabili backend in `Docs/ai` e verificare il gruppo con i test mirati e `npm run docs:check`.

## 2. Preparazione scena

- [ ] 2.1 Aggiungere la bozza `Buio attivo` al form della scena selezionata, includerla in rilevamento modifiche, salvataggio, annullamento e riconciliazione; verificare tipi e bundle con `npm run build`.
- [ ] 2.2 Estendere client API e hook senza introdurre una seconda sorgente di stato e rimuovere il controllo legacy non raggiungibile; verificare che non restino chiamanti del vecchio percorso con ricerca statica e build.
- [ ] 2.3 Aggiornare i contratti frontend/visibilità in `Docs/ai` e verificare con `npm run docs:check`.
- [ ] 2.4 Verificare manualmente nel browser, in assenza di un runner component UI, salvataggio e annullamento su scena attiva/inattiva e aggiornamento senza reload su Master e Player.

## 3. Integrazione

- [ ] 3.1 Verificare che la change coordinatrice P0.9 mantenga la ventiduesima foglia nei conteggi e nel percorso di revisione.
- [ ] 3.2 Eseguire `npm test`, `npm run build`, `npm run docs:check`, `git diff --check` e `openspec validate p0-9b-5-scene-darkness-control --strict --no-interactive`.
