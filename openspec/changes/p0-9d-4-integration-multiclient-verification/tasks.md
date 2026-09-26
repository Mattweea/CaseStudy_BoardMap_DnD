# Tasks

## 1. Preparazione matrice

- [ ] 1.1 Definire fixture/database/storage temporanei e checklist Master + due Player.
- [ ] 1.2 Mappare ogni requisito P0.9 a test automatico o passo manuale osservabile.

## 2. Scenario integrato

- [ ] 2.1 Eseguire create/edit/activate su due scene, background, calibrazione, Dungeon/Combat, drawing, elementi, blocker, encounter e party transfer.
- [ ] 2.2 Verificare reconnect, evento stale, rifiuto switch a round attivo e autorizzazione Player.
- [ ] 2.3 Eseguire migrazione legacy e riavvio distinguendo config recuperata e runtime non promesso.

## 3. Regressioni e consegna

- [ ] 3.1 Eseguire npm test, npm run build, npm run docs:check e git diff --check.
- [ ] 3.2 Confrontare implementazione con tutte le delta P0.9 e registrare evidenze e check saltati.
- [ ] 3.3 Validare p0-9d-4-integration-multiclient-verification in modalità strict.
