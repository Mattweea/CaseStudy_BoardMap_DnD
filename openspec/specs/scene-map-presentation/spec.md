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

### Requirement: P0.9b.2 Integrazione con la griglia esistente
La scena attiva SHALL fornire dimensioni e configurazione scene-specific alla griglia applicativa e al sistema esistente di movimento e misurazione, senza introdurre una seconda griglia, una seconda unità o nuove regole di costo.

#### Scenario: Configurazione della scena attiva
- **WHEN** diventa attiva una scena con configurazione valida
- **THEN** griglia, righello, sagome e movimento usano insieme i suoi valori

#### Scenario: Regole di movimento invariate
- **WHEN** un token pianifica o conferma un percorso
- **THEN** costi, diagonalità, budget e validazione restano governati dalla capability esistente
