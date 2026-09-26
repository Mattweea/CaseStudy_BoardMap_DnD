## ADDED Requirements

### Requirement: P0.9e.5 Persistenza della configurazione encounter
Il sistema SHALL persistere encounter, entità e placement preparati come configurazione versionata associata alla scena, senza includere automaticamente lo stato live completo della sessione.

#### Scenario: Riapertura
- **WHEN** il server viene riavviato dopo la configurazione
- **THEN** definizione, entità e placement preparati sono nuovamente disponibili al Master

#### Scenario: Stato live escluso
- **WHEN** durante la sessione cambiano round, turno, HP, condizioni o posizione live dei token derivati
- **THEN** P0.9e.5 non promette che tali cambi siano recuperati automaticamente dopo il riavvio

#### Scenario: Commit coerente
- **WHEN** una mutazione encounter viene accettata
- **THEN** la versione scena avanza una sola volta e il documento resta privo di riferimenti orfani

#### Scenario: Errore di persistenza
- **WHEN** SQLite rifiuta la scrittura
- **THEN** configurazione, versione e proiezione in memoria restano invariate
