# Tasks

## 1. Modello e adapter

- [x] 1.1 Definire entity kind monster/npc e riferimenti stabili associati all'encounter; verificare normalizzazione e legacy con test mirati.
- [x] 1.2 Implementare mutazioni Master versionate delle entità; verificare autorizzazione, 409 e persistenza con test API.
- [x] 1.3 Implementare adapter puro verso UnitToken; verificare ID, geometria, movimento e proprietà con test mirati.

## 2. Compatibilità combat

- [x] 2.1 Verificare con test che i token derivati possano usare iniziativa/tracker correnti senza scheda PC.
- [x] 2.2 Verificare con test che definire entità, anche narrative, non avvii combat né materializzi token sulla board.

## 3. Verifica autonoma

- [x] 3.1 Aggiornare i leaf gameplay/backend per il confine E.2/E.4 ed eseguire npm run docs:check.
- [x] 3.2 Eseguire test mirati, npm test, npm run build e git diff --check.
- [x] 3.3 Validare p0-9e-2-encounter-entities in modalità strict.
