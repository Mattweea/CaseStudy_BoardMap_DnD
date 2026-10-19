# Tasks

## 1. Persistenza

- [x] 1.1 Integrare encounter/entity/placement nel documento normalizzato e repository scena.
- [x] 1.2 Applicare persist-before-project con un solo incremento versione.
- [x] 1.3 Testare riapertura, conflitto, riferimenti orfani e failure injection.

## 2. Confine runtime

- [x] 2.1 Verificare che authoring persista i valori iniziali.
- [x] 2.2 Verificare che movimento, HP, round e condizioni live non riscrivano la configurazione.
- [x] 2.3 Eseguire scenario di riavvio documentando ciò che P0.11 dovrà recuperare.

## 3. Verifica autonoma

- [x] 3.1 Aggiornare i leaf persistenza/gameplay ed eseguire npm run docs:check.
- [x] 3.2 Eseguire test mirati, npm test, npm run build e git diff --check.
- [x] 3.3 Validare p0-9e-5-encounter-persistence in modalità strict.
