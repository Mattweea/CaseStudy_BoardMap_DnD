# Tasks

## 1. Service e API

- [ ] 1.1 Implementare attivazione Master-only con validazione, versione e installazione atomica.
- [ ] 1.2 Bloccare a round attivo e definire reset in roll phase.
- [ ] 1.3 Testare Dungeon, roll phase, round, 403, conflitto e failure injection.

## 2. Realtime e client

- [ ] 2.1 Propagare activeSceneId e sceneId negli eventi pertinenti.
- [ ] 2.2 Ignorare eventi tardivi della scena precedente e riallineare su reconnect.
- [ ] 2.3 Verificare Master e due Player senza reload.

## 3. Verifica autonoma

- [ ] 3.1 Aggiornare i leaf realtime/gameplay ed eseguire npm run docs:check.
- [ ] 3.2 Eseguire test mirati, npm test, npm run build e git diff --check.
- [ ] 3.3 Validare p0-9d-1-realtime-scene-transition in modalità strict.
