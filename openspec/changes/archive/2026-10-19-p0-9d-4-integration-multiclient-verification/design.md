# Design

## Context

Le verifiche locali non dimostrano ordine degli eventi, sanitizzazione per ruolo, migrazione o compatibilità fra scene e sistemi correnti.

## Goals / Non-Goals

**Goals:** evidenza end-to-end ripetibile e regressioni ad alto rischio.

**Non-Goals:** implementare segretezza P0.10 o recovery completo P0.11 come condizione di successo.

## Decisions

### 1. Matrice minima

Un Master e due Player attraversano almeno due scene, incluso reconnect.

La prova automatica avvia il vero entrypoint Fastify su loopback e porta casuale, con tre login SQLite e connessioni SSE effettive. Copia solo i moduli sorgente in una directory temporanea, con dipendenze condivise in lettura: anche i percorsi runtime relativi al server, gli asset e lo snapshot legacy sono isolati. Non usa la partita corrente. La verifica visiva resta distinta, coperta dall'accettazione utente dei flussi precedenti e della collocazione E.4.

### 2. Riavvio con aspettative esplicite

Configurazione e preparazione devono tornare; round, movimento e stato live non sono asseriti.

### 3. Verifica legacy

La board legacy viene importata una sola volta prima dell'uso multi-scena.

## Risks / Trade-offs

- [Test manuale non ripetibile] → Checklist ed evidenze puntuali, automatizzando i contratti critici.
- [Confini milestone confusi] → Assertion positive sulla configurazione e negative sulle promesse P0.10/P0.11.

## Dipendenze

Dipende dalle sotto-change P0.9a–c, p0-9d-1/2/3 e P0.9e completa.
