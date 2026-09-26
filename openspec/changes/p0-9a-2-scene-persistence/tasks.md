# Tasks

## 1. Schema e repository

- [ ] 1.1 Aggiungere migrazioni immutabili con vincoli, indici, up e down.
- [ ] 1.2 Implementare repository per catalogo, documenti, scena attiva e update ottimistico.
- [ ] 1.3 Verificare migrate, secondo migrate, rollback, reapply e riapertura su database temporaneo.

## 2. Bootstrap e service

- [ ] 2.1 Implementare persist-before-project e risposta ai conflitti.
- [ ] 2.2 Implementare bootstrap legacy idempotente con snapshot valido, assente e malformato.
- [ ] 2.3 Verificare failure injection senza divergenza fra database e memoria.

## 3. Verifica autonoma

- [ ] 3.1 Aggiornare i leaf database/backend instradati ed eseguire npm run docs:check.
- [ ] 3.2 Eseguire test database/backend, npm test e git diff --check.
- [ ] 3.3 Validare p0-9a-2-scene-persistence in modalità strict.
