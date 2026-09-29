# Design

## Context

Il documento scena normalizzato possiede già `board.isFullyLit`, la proiezione attiva lo espone come `isBoardFullyLit` e la Board applica già oscuramento, luci e scurovisione. Il vecchio controllo in `App.tsx` appartiene a una superficie non raggiungibile nella nuova workspace e non consente di preparare una scena inattiva. Il catalogo scene dispone invece di bozza locale, salvataggio esplicito, concorrenza ottimistica e riconciliazione `409`.

## Goals / Non-Goals

**Goals:**

- Rendere `board.isFullyLit` modificabile nello stesso form versionato di nome, calibrazione e dimensioni.
- Mantenere separati bozza locale, documento persistito e proiezione della scena attiva.
- Riutilizzare rendering, normalizzazione, autorizzazione e broadcast già esistenti.

**Non-Goals:**

- Fog o occultamento server-side.
- Modifiche a scurovisione, luci puntuali o blocker di visuale.
- Un secondo flag globale di illuminazione.

## Decisions

### 1. Il documento scena resta l'unica autorità

La patch generica della scena accetta un booleano `isFullyLit` e costruisce un nuovo blocco `board` preservandone gli altri campi. Si evita un endpoint dedicato: il valore partecipa alla stessa conferma atomica e allo stesso `baseVersion` degli altri campi del form.

Alternativa scartata: continuare a usare la mutazione legacy dello stato live. Non configura scene inattive e crea due percorsi autorevoli per lo stesso dato.

### 2. Il controllo usa semantica positiva per l'utente

La UI mostra `Buio attivo`; il valore selezionato viene convertito nel campo tecnico inverso `isFullyLit`. La bozza viene inizializzata dal dettaglio selezionato, entra in `hasDraftChanges` e viene scartata insieme agli altri campi quando si cambia o si chiude la selezione.

Alternativa scartata: esporre `Mappa completamente illuminata`, perché la richiesta e il modello mentale della preparazione sono centrati sull'attivazione del buio.

### 3. Broadcast soltanto per la scena attiva

Il servizio persiste prima la nuova versione. Se la scena modificata è attiva, il server ricostruisce la proiezione e invia un solo snapshot versionato; se è inattiva aggiorna soltanto catalogo e dettaglio Master. L'attivazione già installa `isBoardFullyLit` dalla scena destinazione.

### 4. Compatibilità senza migrazione SQL

Il normalizzatore esistente interpreta un valore assente o non booleano come `false` per `isFullyLit`, cioè buio attivo. Il cambiamento estende il payload validato ma non lo schema relazionale né la versione del documento scena.

## Risks / Trade-offs

- [Inversione fra `Buio attivo` e `isFullyLit`] → concentrare la conversione nel draft del form e coprirla con test mirati.
- [Patch parziale sovrascrive altre proprietà board] → costruire il candidato dal documento corrente e sostituire solo il flag validato.
- [Doppio controllo futuro] → rimuovere il rendering legacy non raggiungibile o impedirne il riutilizzo come seconda autorità.
- [Aggiornamento inattivo trasmesso ai Player] → verificare che non avanzi la versione condivisa e non produca broadcast finché la scena non viene attivata.

## Migration Plan

Non serve una migrazione dati. Il default normalizzato mantiene il comportamento corrente; il rollback del codice lascia leggibile il campo già supportato dal modello scena.
