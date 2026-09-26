# Scene Management Specification

## Purpose

Definire il contratto condiviso, versionato e normalizzato delle scene, separando la configurazione preparata dallo stato live della sessione.

## Requirements

### Requirement: P0.9a.1 Modello di scena versionato e normalizzato
Il sistema SHALL rappresentare ogni scena con identificatore stabile, metadati, versione e documento JSON normalizzato, mantenendo sezioni distinte per background, configurazione board, disegni, elementi scenici, placement preparati, token runtime e riferimenti ad altre entità.

#### Scenario: Documento valido
- **WHEN** il server carica o riceve un documento scena valido
- **THEN** applica default e limiti canonici senza fondere disegni, elementi, placement e token

#### Scenario: Documento malformato
- **WHEN** un documento contiene identificatori duplicati, riferimenti invalidi, coordinate fuori limite o supera le soglie ammesse
- **THEN** il server lo rifiuta senza modificare stato o versione

#### Scenario: Confine configurazione e runtime
- **WHEN** durante il gioco cambiano movimento, HP, turno o round
- **THEN** P0.9a.1 non promuove automaticamente tali valori nella configurazione persistente né ne promette il recovery dopo riavvio

### Requirement: P0.9a.2 Persistenza e migrazione legacy delle scene
Il sistema SHALL conservare in SQLite catalogo, metadati, documento JSON e versione delle scene mediante migrazioni immutabili, repository dedicato e aggiornamenti con controllo della versione attesa.

#### Scenario: Riapertura del catalogo
- **WHEN** il server viene riavviato dopo la creazione o modifica di scene
- **THEN** catalogo, configurazioni e riferimento alla scena attiva persistiti sono nuovamente disponibili

#### Scenario: Conflitto di versione
- **WHEN** due mutazioni strutturali usano la stessa versione base
- **THEN** soltanto la prima avanza la versione e la seconda è rifiutata senza sovrascrivere dati

#### Scenario: Migrazione idempotente della board legacy
- **WHEN** il server parte senza scene persistite e trova uno stato board legacy valido
- **THEN** crea una sola scena iniziale con i campi supportati
- **AND** gli avvii successivi non duplicano né reimportano la scena

#### Scenario: Confine P0.11
- **WHEN** il server riparte dopo mutazioni esclusivamente live
- **THEN** P0.9a.2 recupera la configurazione persistita ma non promette il recovery automatico del runtime completo

### Requirement: P0.9a.3 Catalogo scene dedicato al Master
Il sistema SHALL offrire al Master una sezione dedicata dalla quale creare scene, visualizzare il catalogo, selezionare una scena da gestire e modificarne le proprietà previste mediante mutazioni autorizzate e versionate.

#### Scenario: Creazione e modifica
- **WHEN** il Master crea una scena valida e ne modifica una proprietà supportata
- **THEN** catalogo e dettaglio mostrano i valori persistiti e la versione aggiornata

#### Scenario: Selezione senza attivazione
- **WHEN** il Master seleziona nel catalogo una scena inattiva
- **THEN** può gestirne il dettaglio senza distribuirla ai Player

#### Scenario: Accesso Player
- **WHEN** un Player accede alla sessione o invia una mutazione catalogo
- **THEN** non riceve il catalogo completo e la mutazione è rifiutata dal server

#### Scenario: Eliminazione non definita
- **WHEN** il Master usa il catalogo in P0.9a.3
- **THEN** non dispone di delete o archive finché la relativa semantica non viene approvata
