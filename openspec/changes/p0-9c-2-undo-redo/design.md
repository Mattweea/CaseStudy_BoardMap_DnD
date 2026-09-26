# Design

## Context

Il progetto possiede stato autorevole versionato ma non un command model generale da estendere. P0.9c.1 definisce operazioni drawing invertibili.

## Goals / Non-Goals

**Goals:** undo/redo prevedibile e circoscritto.

**Non-Goals:** undo di configurazione, elementi, token, scene o recovery della history.

## Decisions

### 1. Stack per scena

Add/erase registrano l'inversa; una nuova operazione dopo undo svuota redo.

### 2. Limite fisso esistente nel design

La cronologia è limitata a 40 operazioni per scena e viene azzerata al riavvio.

### 3. Risultato persistente

Undo/redo passa dalla normale mutazione versionata, così il drawing finale resta durabile.

## Risks / Trade-offs

- [History diverge dopo conflitto] → Registrare solo operazioni accettate e invalidare stack incoerenti.
- [Scope si espande] → API accetta esclusivamente comandi drawing.

## Dipendenze

Dipende da p0-9c-1-drawing.
