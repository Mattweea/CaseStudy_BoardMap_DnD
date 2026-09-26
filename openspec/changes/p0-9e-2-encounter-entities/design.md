# Design

## Context

UnitToken supporta player/enemy/object/vehicle; l'iniziativa corrente gestisce enemy token anche senza character sheet. Non esiste un modello canonico monster/NPC completo.

## Goals / Non-Goals

**Goals:** entità distinguibili, proiezione token e integrazione combat opzionale.

**Non-Goals:** nuovo tracker, duplicazione di UnitToken o scheda completa mostro/PNG.

## Decisions

### 1. Kind di dominio separato

La configurazione distingue monster/npc; l'adapter sceglie il token type canonico compatibile.

### 2. UnitToken come proiezione

Geometria, movimento, selezione e iniziativa runtime restano nel modello corrente.

### 3. Combat opzionale

Solo una decisione esplicita del Master inserisce i token nel flusso combat esistente.

## Risks / Trade-offs

- [Modelli duplicati] → Un adapter unico e test di parità sui campi canonici.
- [NPC confuso con PC] → Nessuna creazione automatica di character sheet.

## Dipendenze

Dipende da p0-9e-1-encounter-lifecycle e dalle capability canoniche token/combat.
