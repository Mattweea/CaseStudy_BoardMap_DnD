## 1. Implementazione
- [x] 1.1 Stato cronologia locale fino a 50 comandi accettati, isolato per sessione utente e cancellato al logout.
- [x] 1.2 Navigazione su/giù, bozza e limiti senza wrap; preservare multilinea, IME, selezione e modificatori.
## 2. Verifica
- [x] 2.1 Test scenari Richiamo: ordine, duplicati, errori, pending, limiti, edit della voce e ripristino bozza; nessun roll da frecce.
- [x] 2.2 Test Isolamento: logout/cambio utente e nessun uso del log globale; includere /rs e futuro -n.
- [x] 2.3 Verifica tastiera reale Enter/Shift+Enter, su/giù multilinea, IME e nessun movimento mappa dal campo attivo.
- [x] 2.4 npm test, build e strict validation; valutare frontend Docs/ai e guida dei comandi, docs:check se modificati.
