# Tasks

## 1. Persistenza

- [ ] 1.1 Integrare encounter/entity/placement nel documento normalizzato e repository scena.
- [ ] 1.2 Applicare persist-before-project con un solo incremento versione.
- [ ] 1.3 Testare riapertura, conflitto, riferimenti orfani e failure injection.

## 2. Confine runtime

- [ ] 2.1 Verificare che authoring persista i valori iniziali.
- [ ] 2.2 Verificare che movimento, HP, round e condizioni live non riscrivano la configurazione.
- [ ] 2.3 Eseguire scenario di riavvio documentando ciò che P0.11 dovrà recuperare.

## 3. Verifica autonoma

- [ ] 3.1 Aggiornare i leaf persistenza/gameplay ed eseguire npm run docs:check.
- [ ] 3.2 Eseguire test mirati, npm test, npm run build e git diff --check.
- [ ] 3.3 Validare p0-9e-5-encounter-persistence in modalità strict.
