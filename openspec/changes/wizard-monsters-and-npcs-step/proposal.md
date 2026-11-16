# Proposal

## Why

Nel wizard attuale la creazione dell'encounter, la preparazione di mostri/PNG e la loro collocazione condividono lo stesso passaggio. Inoltre, dopo aver creato un encounter la selezione viene azzerata: i controlli delle figure restano nascosti finché il Master non riseleziona l'incontro, rendendo poco chiaro come proseguire.

## What Changes

- Il wizard diventa: Base → Pareti e ambiente → Luci e visuale → Encounter → Mostri e PNG → Riepilogo.
- Encounter gestisce nome, tipo e descrizione degli incontri; Mostri e PNG richiede di scegliere un encounter salvato e contiene creazione/modifica delle figure e collocazione sulla preview.
- Il nuovo passaggio mostra chiaramente l'encounter di destinazione e filtra figure e collocazioni per quell'incontro. Senza selezione non consente di creare figure; senza encounter offre il ritorno al passaggio precedente.
- Cambio encounter, cambio passaggio, cambio scena e chiusura risolvono le bozze prima di abbandonarle. Gli strumenti di collocazione sono attivi soltanto nel nuovo passaggio.
- Il riepilogo distingue incontri e figure e offre il collegamento a entrambi i passaggi. Preparare una scena senza encounter rimane possibile.

## Capabilities

### New Capabilities

Nessuna.

### Modified Capabilities

- `scene-preparation-wizard`: sesto passaggio, selezione esplicita dell'encounter per mostri/PNG, gestione delle bozze nel cambio di contesto e riepilogo aggiornato.

## Impact

Frontend: `SceneCatalogPanel`, separazione delle responsabilità di `SceneEncounterSection`, riuso di `SceneEncounterEntitySection` e `SceneEncounterPlacementSection`, layout e navigazione del wizard. Le route versionate e i modelli encounter/entity/placement esistenti sono sufficienti; non occorrono migrazioni o modifiche del formato salvato.

Verifica: test della selezione e delle bozze, aggiornamento di `tools/verify-scene-wizard.mjs`, regressione su quantità, collocazioni, schede creature, scene inattive e permessi Player. Aggiornare il contratto frontend instradato e la guida operativa del wizard.

La correzione del movimento e lo scroll della tab Personaggi sono interventi separati già presenti nel working tree; non fanno parte di questa proposta.
