# Design

## Context

UnitToken supporta player/enemy/object/vehicle; l'iniziativa corrente gestisce enemy token anche senza character sheet. Non esiste un modello canonico monster/NPC completo.

## Goals / Non-Goals

**Goals:** entità distinguibili, adapter token riusabile e compatibilità combat opzionale.

**Non-Goals:** nuovo tracker, duplicazione di UnitToken, scheda completa mostro/PNG o materializzazione dei placement sulla board (P0.9e.4).

## Decisions

### 1. Kind di dominio separato

La configurazione distingue monster/npc e associa ogni riferimento a un encounter con ID stabile. I riferimenti legacy privi di questa associazione restano leggibili. Le mutazioni usano l'autorità Master e la versione della scena.

### 2. UnitToken come proiezione

L'adapter puro riceve entità e futura posizione/istanza, produce un UnitToken canonico e non scrive nel runtime. Geometria, movimento, selezione e iniziativa runtime restano nel modello corrente.

### 3. Combat opzionale

Solo una decisione esplicita del Master inserisce i token nel flusso combat esistente. In E.2 si verifica la compatibilità dell'output dell'adapter con il tracker corrente; l'operazione che colloca i token è E.4.

## Risks / Trade-offs

- [Modelli duplicati] → Un adapter unico e test di parità sui campi canonici.
- [NPC confuso con PC] → Nessuna creazione automatica di character sheet.

## Dipendenze

Dipende da p0-9e-1-encounter-lifecycle e dalle capability canoniche token/combat.
