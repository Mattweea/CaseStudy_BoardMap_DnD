## 1. Interfaccia

- [x] 1.1 Aggiungere il toggle luna/sole nei controlli della board normale e fullscreen, visibile solo al Master, con nome accessibile e stato coerenti; verificare Master/Player e i due stati.
- [x] 1.2 Collegare il toggle a PATCH versionata della scena attiva; verificare che luce completa, buio, luci puntuali e token invisibili conservino il comportamento attuale.
- [x] 1.3 Aggiornare il contratto frontend della board e quello della proiezione della scena; verificare con `npm run docs:check`.

## 2. Verifica

- [x] 2.1 Eseguire `npm run build`, `npm test` (i due test che aprono socket locali fuori sandbox), `git diff --check` e `openspec validate local-board-light-toggle --strict --no-interactive`.
- [ ] 2.2 Controllare lo scenario in due browser, Master e Player, anche in fullscreen, se è disponibile una sessione live; altrimenti riportare esplicitamente che resta una verifica manuale.
