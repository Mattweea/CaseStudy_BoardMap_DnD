# Design

## Context

Lo stato corrente è un unico BattleMapSharedState normalizzato da server e client. I consumer condivisi rendono rischioso spostare campi senza un adapter compatibile.

## Goals / Non-Goals

**Goals:** schema versionato, separazione dei layer, validazione referenziale e compatibilità con la board corrente.

**Non-Goals:** SQLite, UI catalogo, asset, strumenti, encounter o persistenza del runtime live.

## Decisions

### 1. Documento a sezioni esplicite

Il documento usa collezioni separate e identificatori stabili. I layer non ancora implementati partono vuoti; non vengono rappresentati come token generici.

### 2. Configurazione distinta dal runtime

Helper puri convertono fra configurazione preparata e proiezione runtime. Round, iniziativa, HP e movimento live non diventano automaticamente configurazione persistente.

### 3. Normalizzazione condivisa

Default e limiti sono canonici e applicati prima dell'uso di dati persistiti o non fidati.

## Risks / Trade-offs

- [Schema troppo ampio] → Versionare e limitare ogni sezione, introducendo solo campi richiesti.
- [Divergenza client/server] → Condividere tipi e test fixture di normalizzazione.

## Dipendenze

È la prima change della catena P0.9 e non dipende dalle altre sotto-change.
