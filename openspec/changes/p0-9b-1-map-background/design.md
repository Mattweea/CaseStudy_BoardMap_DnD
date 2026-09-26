# Design

## Context

Il progetto dispone già di upload multipart autenticato per i ritratti, con storage runtime, verifica firma e path confinement. La scena P0.9a offre il documento persistente.

## Goals / Non-Goals

**Goals:** board bianca, upload sicuro, sostituzione compensata e serving autorizzato.

**Non-Goals:** cataloghi esterni, mappe ufficiali, CDN o nuove librerie asset.

## Decisions

### 1. Pattern storage esistente

Un adapter dedicato riusa magic bytes, limiti, staging, rename atomico e path confinement. Il documento conserva ID e metadati, non path filesystem.

### 2. Board bianca esplicita

L'assenza di asset è una configurazione valida e renderizza il background neutro corrente.

### 3. Accesso per ruolo e scena

Master può leggere asset gestiti; Player soltanto quello necessario alla scena attiva secondo i confini correnti.

## Risks / Trade-offs

- [File orfani] → Compensazione su errore DB e cleanup conservativo.
- [MIME contraffatto] → Verifica firma oltre a estensione e Content-Type.

## Dipendenze

Dipende da p0-9a-1-scene-model, p0-9a-2-scene-persistence e p0-9a-3-scene-catalog.
