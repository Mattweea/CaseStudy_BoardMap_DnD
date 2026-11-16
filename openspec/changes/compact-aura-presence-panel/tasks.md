## 1. Pannello compatto

- [x] 1.1 Implementare pulsante Aure con contatore, elenco inizialmente chiuso, dettagli esistenti, chiusura da pulsante/Escape e reset su uscita/cambio scena o utente. Verificare con test di componente aggiornamenti senza riapertura, contenuto, annunci e filtri di presenza.
- [x] 1.2 Ancorare il controllo in alto a destra dell'host attivo e limitare il pannello con scroll. Verificare nel browser desktop/mobile, anche nell'host fullscreen, ingombro chiuso, accessibilità da tastiera, dettagli e assenza di sovrapposizione con assi e altri controlli.

## 2. Contratti e verifica

- [x] 2.1 Aggiornare il contratto frontend e i comandi in-app per apertura e chiusura; eseguire `npm run docs:check`, test del catalogo e `git diff --check`.
- [x] 2.2 Eseguire `npm run build`, i test di presenza/rendering e `openspec validate compact-aura-presence-panel --strict --no-interactive`; confrontare gli scenari del delta con i risultati prima del commit su `test`.
