# Tasks

## 1. Modello e storage

- [ ] 1.1 Aggiungere background bianco/metadati asset al documento con default legacy.
- [ ] 1.2 Implementare storage con limiti, firma, staging e path confinement.
- [ ] 1.3 Verificare file valido, vuoto, troncato, MIME discordante, traversal e failure injection.

## 2. API e UI

- [ ] 2.1 Implementare upload/sostituzione e serving autenticato Master-only per le mutazioni.
- [ ] 2.2 Integrare board bianca/upload nel catalogo scena con bozza e annullamento.
- [ ] 2.3 Verificare due client, autorizzazione, ETag/cache privata e compensazione.

## 3. Verifica autonoma

- [ ] 3.1 Aggiornare documentazione operativa e backend ed eseguire npm run docs:check.
- [ ] 3.2 Eseguire test mirati, npm test, npm run build e git diff --check.
- [ ] 3.3 Validare p0-9b-1-map-background in modalità strict.
