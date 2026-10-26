## 1. Esplorazione e implementazione
- [x] 1.1 Riprodurre SceneEncounterEntitySection/SceneEncounterPlacementSection usato dal master e identificare perché Quantità non risulta disponibile; riusare il flusso esistente.
- [x] 1.2 Implementare/collegare quantità e validazione 1–100, nomina legacy, ID e collocamento distinti.
- [x] 1.3 Garantire autorizzazione, commit atomico, gestione 409, SSE e undo del lotto.
## 2. Verifica
- [x] 2.1 Test automatici per tutti gli scenari Quantità e Nomina legacy, inclusi tentativo non master, collisioni e richiesta stale senza creazione parziale.
- [x] 2.2 Verifica manuale del modulo master, lotto di 4 e non regressione di veicoli/ostacoli e login canonico.
- [x] 2.3 npm test, build, strict validation; valutare Docs/ai gameplay/backend/frontend e docs:check se modificati.

- [x] 2.4 Test di un'unica definizione con 4 placement, preview/annullamento senza scritture, scena attiva/inattiva, riapertura, versione scena/runtime e rollback su errore SQLite; nomi individuali nell'adapter UnitToken.
