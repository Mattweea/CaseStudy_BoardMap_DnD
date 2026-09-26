# Design

## Context

Le collezioni esistenti supportano rimozioni versionate, ma non esiste una semantica canonica per eliminare un aggregato persistente con asset e riferimenti come una scena.

## Goals / Non-Goals

**Goals:** catalogo vero e proprio, CRUD approvato tranne delete, accessibilità e autorizzazione.

**Non-Goals:** attivazione realtime, eliminazione, archiviazione o cartelle di scene.

## Decisions

### 1. Selezione distinta dall'attivazione

Il Master può selezionare una scena da gestire senza distribuirla ai Player.

### 2. Lifecycle conservativo

Create, list, read e update sono inclusi; delete/archive resta fuori scope finché non viene deciso cascade, soft delete o altra semantica.

### 3. Bozza locale

Le proprietà in modifica non entrano nello stato condiviso fino alla conferma.

## Risks / Trade-offs

- [Selezione confusa con attivazione] → Controlli e stato UI distinti.
- [Player accede al catalogo] → Route e payload autorizzati dal server, non solo nascosti dalla UI.

## Dipendenze

Dipende da p0-9a-1-scene-model e p0-9a-2-scene-persistence.
