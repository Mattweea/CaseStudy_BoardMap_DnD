## 1. Implementazione

- [x] 1.1 Coordinare maschere con opaque-map-darkness e persistent-explored-map senza cambiare la regione visibile autorevole.
- [x] 1.2 Implementare feather confinato alla parte rivelata, scalato coerentemente in entrambe le Board e privo di cuciture interne.

## 2. Verifica e documentazione

- [x] 2.1 Requisito Bordo sfumato: screenshot e pixel su sfondo contrastato, angoli, corridoi stretti e unione di aree note; interno nero esatto e transizione graduale.
- [x] 2.2 Requisito Nessuna rivelazione: luce/visione contro muri, scurovisione, token nascosti e memoria persistente invariati; la sfumatura non aggiunge regioni esplorate.
- [x] 2.3 Requisito Coerenza: zoom/pan, fullscreen, resize e più sorgenti di luce senza cuciture o variazioni di larghezza logica.
- [x] 2.4 Aggiornare il contratto frontend di visibilità in Docs/ai; build, docs:check, git diff --check e strict validation. Eseguire test pertinenti se cambia geometria condivisa.
