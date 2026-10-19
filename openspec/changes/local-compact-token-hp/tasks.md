## 1. Presentazione dei PF

- [x] 1.1 Rendere compatta la barra PF di tutti i token con HP, mantenendo riempimento attuale e temporaneo, colori e stato a zero. Verificare il caso con 40/40 e PF temporanei.
- [x] 1.2 Espandere barra e numeri su hover e focus da tastiera, con priorità visiva sul token vicino; verificare ritorno allo stato compatto e nessuna barra sui token senza massimo valido.
- [x] 1.3 Aggiornare il contratto frontend della board senza cambiare calcolo, riservatezza o markup del token.

## 2. Verifica

- [x] 2.1 Eseguire `npm run build`, `npm run docs:check`, `git diff --check` e `openspec validate local-compact-token-hp --strict --no-interactive`.
- [ ] 2.2 Verificare visivamente con Master e Player nella sessione live, inclusi token adiacenti, hover, focus e PF temporanei, se la sessione è accessibile; altrimenti riportare la verifica manuale ancora necessaria.
