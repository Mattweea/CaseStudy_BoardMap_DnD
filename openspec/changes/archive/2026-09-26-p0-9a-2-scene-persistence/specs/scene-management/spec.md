## ADDED Requirements

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
