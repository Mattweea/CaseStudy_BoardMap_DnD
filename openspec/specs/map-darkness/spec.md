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

### Requirement: Velo del buio nella vista Master

Quando il buio della scena attiva è abilitato, il sistema SHALL indicare nella vista Master il terreno sconosciuto al party con un velo nero semitrasparente al 45%, mantenendo leggibili la mappa e tutti i token che il Master può gestire. Il terreno esplorato SHALL rimanere scoperto. La luce completa SHALL rimuovere il velo. L'effetto SHALL funzionare nella board normale e fullscreen, senza intercettare puntamento, selezione o movimento. La vista Player SHALL mantenere nero pieno e opaco sul terreno sconosciuto e SHALL conservare le regole correnti di visibilità delle creature.

#### Scenario: Master e Player nella stessa scena

- **WHEN** il Master abilita il buio e Master e Player osservano un'area sconosciuta
- **THEN** il Master distingue ancora la mappa sotto il velo al 45%, mentre il Player vede nero opaco

#### Scenario: Terreno ricordato e creature

- **WHEN** il party si allontana da un'area esplorata
- **THEN** entrambi mantengono visibile il terreno ricordato, il Master mantiene i propri permessi sulle creature e il Player non ottiene visione corrente grazie alla memoria

#### Scenario: Luce completa e fullscreen

- **WHEN** si attiva la luce completa oppure si apre la stessa scena in fullscreen
- **THEN** la luce completa elimina il velo in entrambe le viste e fullscreen mantiene il comportamento del ruolo corrente
