# Scene Map Presentation Specification

## Purpose

Definire come ogni scena presenta una board neutra o un'immagine caricata dal Master, mantenendo accesso, compatibilità e sostituzione sicuri.

## Requirements

### Requirement: P0.9b.1 Background bianco o immagine del Master
Il sistema SHALL consentire al Master di configurare ogni scena con una board bianca oppure con una propria immagine JPEG, PNG o WebP caricata tramite storage runtime autenticato e validato.

#### Scenario: Board bianca
- **WHEN** la scena è configurata senza immagine
- **THEN** la board mostra lo sfondo neutro e la griglia applicativa senza richiedere asset

#### Scenario: Upload valido
- **WHEN** il Master carica un'immagine valida entro i limiti
- **THEN** il server la conserva nello storage runtime e associa alla scena soltanto metadati e URL autenticato

#### Scenario: File o accesso non valido
- **WHEN** il file non supera la validazione o un utente non autorizzato richiede l'asset
- **THEN** il server rifiuta senza sostituire il background corrente

#### Scenario: Nessuna sorgente esterna
- **WHEN** il Master configura il background
- **THEN** P0.9b.1 non accetta URL remote né integra mappe ufficiali o cataloghi esterni

#### Scenario: Conflitto di versione
- **WHEN** un upload o un reset usa una versione base della scena ormai superata
- **THEN** il server rifiuta la mutazione senza sostituire il background corrente

#### Scenario: Compatibilità con scene esistenti
- **WHEN** viene caricata una scena legacy senza configurazione background
- **THEN** il sistema la normalizza come board bianca senza richiedere migrazioni manuali
