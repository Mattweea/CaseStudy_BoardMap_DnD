# Tasks

## 1. Modello e service

- [x] 1.1 Definire placement e link encounter/entity/token con validazione referenziale.
- [x] 1.2 Implementare add/update/remove Master-only e optimistic concurrency.
- [x] 1.3 Testare orfani, versioni stale e autorizzazione.

## 2. Board e adapter

- [x] 2.1 Integrare placement con Board e trasformazioni token esistenti.
- [x] 2.2 Implementare materializzazione/aggiornamento UnitToken con ID/link stabile.
- [x] 2.3 Verificare move, resize supportato, pan, zoom e separazione dagli elementi.

## 3. Visibilità e verifica

- [x] 3.1 Integrare hidden con sanitizzazione corrente e testare Master/Player.
- [x] 3.2 Documentare esplicitamente il confine P0.10 nei leaf Docs/ai.
- [x] 3.3 Eseguire test/build/check e validare p0-9e-4-encounter-placement strict.

## 4. Accettazione UI

- [ ] 4.1 Provare nel browser il nuovo flusso di collocazione con Master e Player: creare un'istanza, trascinarla nella preview con pan/zoom, modificarne l'ingombro, nasconderla/mostrarla e rimuoverla; confrontare board normale e fullscreen. L'approvazione dei test precedenti non copre questa nuova UI.
