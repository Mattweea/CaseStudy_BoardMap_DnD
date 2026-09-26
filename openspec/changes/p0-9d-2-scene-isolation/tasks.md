# Tasks

## 1. Server

- [ ] 1.1 Richiedere e validare sceneId/versione sulle mutazioni Player pertinenti.
- [ ] 1.2 Sanitizzare HTTP/SSE omettendo ogni contenuto inattivo.
- [ ] 1.3 Testare identità diverse, replay stale e riconnessione.

## 2. Client

- [ ] 2.1 Resettare camera, selezione, percorso, righello, sagoma, ping e camminata al cambio.
- [ ] 2.2 Ignorare eventi effimeri di scene non attive.
- [ ] 2.3 Verificare cambio durante ogni interazione.

## 3. Audit e verifica

- [ ] 3.1 Produrre un audit mirato dei filtri correnti e del confine P0.10 nei leaf Docs/ai.
- [ ] 3.2 Eseguire npm run docs:check, test mirati, npm test, npm run build e git diff --check.
- [ ] 3.3 Validare p0-9d-2-scene-isolation in modalità strict.
