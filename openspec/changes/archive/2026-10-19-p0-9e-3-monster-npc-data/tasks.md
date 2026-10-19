# Tasks

## 1. Contratto dati

- [x] 1.1 Derivare dai modelli correnti il set minimo di campi e documentarne il mapping.
- [x] 1.2 Validare i dati manuali opzionali sul server e conservarli tramite create/update Master-only versionati, senza collegamenti a cataloghi non verificabili.
- [x] 1.3 Testare monster/npc, valori mancanti e invalidi, documenti E.2, conflitti/versioni, autorizzazione e assenza di assunzioni PC o token live impliciti.

## 2. Editor e guardrail

- [x] 2.1 Implementare editor manuale minimo di creazione e modifica riusando controlli esistenti, con feedback di conflitto e senza collocazione automatica.
- [x] 2.2 Aggiungere test/guardrail che escludano URL, richieste e dipendenze esterne.
- [x] 2.3 Verificare che nessun import o collegamento a catalogo venga presentato in UI.

## 3. Verifica autonoma

- [x] 3.1 Aggiornare i leaf gameplay/frontend ed eseguire npm run docs:check.
- [x] 3.2 Eseguire test mirati, npm run build e git diff --check.
- [x] 3.3 Validare p0-9e-3-monster-npc-data in modalità strict.
