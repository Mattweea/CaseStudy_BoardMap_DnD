## 1. Implementazione
- [x] 1.1 Parser testabile della grammatica /r e /rs con -n opzionale e validazione degli errori prima della richiesta di tiro.
- [x] 1.2 Campo nome opzionale validato server-side e conservato nei log/normalizzazione senza confonderlo con source o formula.
- [x] 1.3 Nome nella card chat con formula/totale/dettagli invariati; mantenere cronologia del comando integrale se dice-command-history è applicato.
## 2. Verifica
- [x] 2.1 Test Nome facoltativo e Errori: esempio esatto, /rs, sottrazioni, più gruppi, Unicode, escape, vuoto, >120, ripetizione, virgolette aperte e testo residuo; nessun roll per input invalido.
- [x] 2.2 Test Log distinguibile e Visibilità: nome/formula separati, autore server, API diretta, destinatari segreti, vecchi log e rendering sicuro del testo.
- [x] 2.3 Verificare manualmente textbox e card, aggiornare guida comandi e Docs/ai pertinenti senza riscrivere il contratto del motore.
- [x] 2.4 npm test, build, docs:check se necessario e strict validation.
