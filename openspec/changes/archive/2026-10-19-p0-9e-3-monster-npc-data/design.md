# Design

## Context

Le character sheet correnti sono orientate ai personaggi giocanti. UnitToken richiede un insieme più piccolo di dati iniziali. Il riferimento a 5e.tools era esplorativo.

## Goals / Non-Goals

**Goals:** dati minimi manuali espliciti, distinzione monster/npc e punto di estensione futuro.

**Non-Goals:** monster sheet definitiva, stat block completo, automazione regole, import dati o catalogo canonico di creature.

## Decisions

### 1. Minimo derivato da UnitToken

L'entità conserva `name` e `entityType` (`monster`/`npc`) e gli identificatori locali stabili di E.2. I dati opzionali di preparazione corrispondono solo ai campi già accettati dall'adapter `projectEncounterEntityToken`: `size`, `widthCells`, `heightCells`, `color`, `initiativeModifier`, `movementCells`, `hitPoints`, `maxHitPoints`, `isInvisible`, `excludeFromInitiative`. Il placement futuro fornisce ID istanza e posizione; proprietà derivate come `type`, `affiliation`, ownership, `initiativeMode` e condizioni restano responsabilità dell'adapter. L'editor espone prima nome, tipo e valori di combattimento essenziali, con le restanti opzioni in una sezione avanzata.

### 2. Solo riferimenti locali in E.3

Non esiste oggi un catalogo canonico monster/npc verificabile. `entityId` resta l'ID locale della definizione creata manualmente; E.3 non aggiunge un riferimento esterno né tenta di risolverne uno. Un change futuro potrà introdurre un riferimento canonico opzionale insieme a sorgente, autorizzazione, validazione, compatibilità e migrazione.

### 3. Scrittura versionata e compatibilità

Le proprietà opzionali sono validate sul server usando gli stessi limiti del mapping token. Create e update restano Master-only, usano `baseVersion` e rifiutano versioni obsolete senza scrivere; l'update conserva ID e link all'encounter. I documenti E.2 privi dei nuovi dati normalizzano a una definizione con soli nome e tipo. La lettura Player non espone la preparazione privata e nessuna di queste scritture materializza token live.

### 4. Nessuna integrazione esterna

Import, licensing, provenienza e mapping richiedono una nuova decisione OpenSpec.

## Risks / Trade-offs

- [Minimo cresce in scheda completa] → Ogni campo deve essere giustificato dal mapping runtime corrente.
- [Sorgente esterna introdotta incidentalmente] → Guardrail/test su dipendenze e richieste di rete.

## Dipendenze

Dipende da p0-9e-2-encounter-entities.
