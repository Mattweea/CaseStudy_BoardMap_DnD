# Tasks

## 1. Schema e repository

- [x] 1.1 Aggiungere migrazioni immutabili con vincoli, indici, up e down.
- [x] 1.2 Implementare repository per catalogo, documenti, scena attiva e update ottimistico.
- [x] 1.3 Verificare migrate, secondo migrate, rollback, reapply e riapertura su database temporaneo.

## 2. Bootstrap e service

- [x] 2.1 Implementare persist-before-project e risposta ai conflitti.
- [x] 2.2 Implementare bootstrap legacy idempotente con snapshot valido, assente e malformato.
- [x] 2.3 Verificare failure injection senza divergenza fra database e memoria.

## 3. Verifica autonoma

- [x] 3.1 Aggiornare i leaf database/backend instradati ed eseguire npm run docs:check.
- [x] 3.2 Eseguire test database/backend, npm test e git diff --check.
- [x] 3.3 Validare p0-9a-2-scene-persistence in modalità strict.
