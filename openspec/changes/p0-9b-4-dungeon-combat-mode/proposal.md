# Proposal

## Why

Il Master deve distinguere esplicitamente Dungeon e Combattimento senza creare una seconda macchina a stati o duplicare il tracker.

## What Changes

- Espone lo switch Dungeon/Combattimento.
- Mappa Dungeon sul valore tecnico exploration e riusa combat.
- Non aggiunge meccaniche Dungeon oltre all'esplorazione corrente.

## Capabilities

### New Capabilities

- scene-map-presentation: presentazione della scena sulla board esistente.

### Modified Capabilities

- combat-session-mode: Esplorazione viene presentata come Dungeon mantenendo exploration/combat e il lifecycle esistenti.

## Impact

- Modifica di etichette e mapping UI, non del wire contract.
- Regressioni mirate su autorizzazione, iniziativa, round e snapshot legacy.
