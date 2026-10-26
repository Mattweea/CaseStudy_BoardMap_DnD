# map-darkness Specification

## Purpose

Garantire che le zone della mappa ancora sconosciute siano nere e opache, conservando le aperture consentite dalla visione.

## Requirements

### Requirement: Buio opaco

Il sistema SHALL rendere ogni area non esplorata e non attualmente visibile, interamente coperta dal buio come nero pieno e opaco, senza lasciare distinguere immagine, griglia o dettagli della mappa sottostante.

#### Scenario: Sfondo chiaro sotto il buio

- **WHEN** il buio copre una zona non esplorata con immagine e griglia ad alto contrasto
- **THEN** l’interno della zona è nero RGB (0,0,0) e non rivela i dettagli sottostanti

#### Scenario: Cambio della visualizzazione

- **WHEN** la stessa zona buia non esplorata è osservata dopo zoom, pan o ingresso in fullscreen
- **THEN** la copertura resta nera e opaca

### Requirement: Aree rivelate e ruoli

Il sistema SHALL conservare le aree visibili consentite da luci, visione e scurovisione e SHALL applicare la copertura opaca a ogni area che il ruolo corrente vede già come oscurata, senza concedere visibilità a token nascosti.

#### Scenario: Luce e ostacoli

- **WHEN** un adventurer osserva una zona illuminata e una zona non esplorata oscurata dietro un ostacolo
- **THEN** la prima resta visibile secondo le regole esistenti e la seconda è nero pieno

#### Scenario: Mappa illuminata e master

- **WHEN** la mappa è completamente illuminata oppure il master usa i propri controlli di visione
- **THEN** la correzione non introduce nuove restrizioni e conserva i permessi esistenti
