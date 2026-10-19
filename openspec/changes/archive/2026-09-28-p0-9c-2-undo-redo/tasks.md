# Tasks

## 1. Service

- [x] 1.1 Implementare stack undo/redo per scena limitati a 40 e popolati solo da add/erase accettati.
- [x] 1.2 Persistire ogni risultato tramite la mutazione scena.
- [x] 1.3 Testare isolamento, limite, redo invalidato, conflitto e reset.

## 2. Controlli

- [x] 2.1 Aggiungere controlli e scorciatoie Master con stato enabled/disabled; verificare in UI click, scorciatoie e isolamento dall'undo globale.
- [x] 2.2 Verificare che altre mutazioni non entrino nella history.

## 3. Verifica autonoma

- [x] 3.1 Aggiornare il leaf frontend/backend ed eseguire npm run docs:check.
- [x] 3.2 Eseguire test mirati, npm run build e git diff --check.
- [x] 3.3 Validare p0-9c-2-undo-redo in modalità strict.
