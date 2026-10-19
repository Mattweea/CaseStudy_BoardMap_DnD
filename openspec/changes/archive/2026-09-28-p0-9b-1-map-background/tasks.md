# Tasks

## 1. Modello e storage

- [x] 1.1 Aggiungere background bianco/metadati asset al documento con default legacy.
- [x] 1.2 Implementare storage con limiti, firma, staging e path confinement.
- [x] 1.3 Verificare file valido, vuoto, troncato, MIME discordante, traversal e failure injection.

## 2. API e UI

- [x] 2.1 Implementare upload/sostituzione e serving autenticato Master-only per le mutazioni.
- [x] 2.2 Integrare board bianca/upload nel catalogo scena con bozza e annullamento.
- [x] 2.3 Verificare due client, autorizzazione, ETag/cache privata e compensazione.

## 3. Verifica autonoma

- [x] 3.1 Aggiornare documentazione operativa e backend ed eseguire npm run docs:check.
- [x] 3.2 Eseguire test mirati, npm test, npm run build e git diff --check.
- [x] 3.3 Validare p0-9b-1-map-background in modalità strict.
