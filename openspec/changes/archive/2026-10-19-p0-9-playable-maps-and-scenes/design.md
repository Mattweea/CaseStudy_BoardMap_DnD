# Design

## Context

Le capability canoniche possiedono già board, movimento/misurazione, token, iniziativa, combattimento e persistenza a repository. La scomposizione integra tali contratti senza sistemi paralleli.

## Goals / Non-Goals

**Goals:** autonomia di validazione al livello P0.9x.y, dipendenze esplicite e confini P0.10/P0.11 verificabili.

**Non-Goals:** duplicare delta nelle macro-sezioni a–e, creare nuova griglia/unità/combat engine o implementare codice.

## Decisions

### 1. Le macro-sezioni sono gruppi, le foglie sono change

P0.9a–e descrivono cinque stream logici. Ciascun punto numerato è una directory OpenSpec piatta, perché OpenSpec non modella nesting ma può validare autonomamente ogni change.

### 2. Ordine di applicazione

Applicare a.1→a.2→a.3/a.4; quindi b e c rispettando le dipendenze dichiarate; d.1–d.3; e.1–e.5; infine d.4 come verifica integrata. Le change b.2 e b.4 modificano le capability canoniche esistenti invece di duplicarle.

### 3. Configurazione distinta dal runtime

Il documento persistente contiene definizione, background, board config, disegni, elementi, encounter e placement. Movimento, HP, round, log e runtime completo restano in memoria in P0.9 e diventano durabili soltanto con P0.11.

### 4. Riutilizzo dei contratti correnti

Dungeon è l'etichetta UI di exploration; la griglia e measurementUnit sono quelle esistenti; encounter placement si proietta in UnitToken e usa il tracker corrente; gli elementi scenici restano separati.

### 5. Lifecycle conservativo

Le scene non ricevono delete/archive finché non è approvata una semantica per aggregati radice. Gli encounter riusano la rimozione versionata delle collezioni e bloccano la rimozione con placement collegati.

## Risks / Trade-offs

- [Molte change attive sulla stessa capability] → titoli di requirement unici e ordine di sync dichiarato.
- [Dipendenze applicate fuori ordine] → ogni design foglia espone le proprie dipendenze.
- [Confine runtime ambiguo] → scenari di riavvio distinguono sempre configurazione e live state.

## Migration Plan

Validare ogni foglia prima dell'apply e prima dell'archive. Sincronizzare/archiviare secondo l'ordine di dipendenza e archiviare questa umbrella soltanto dopo tutte le foglie.
