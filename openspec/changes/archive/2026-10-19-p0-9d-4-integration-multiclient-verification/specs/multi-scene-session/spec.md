## ADDED Requirements

### Requirement: P0.9d.4 Verifica integrata multi-scena e multi-client
L'implementazione P0.9 SHALL essere verificata con un Master e più Player attraverso scene multiple, scena attiva, background, griglia, calibrazione, modalità Dungeon/Combattimento, drawing, elementi, encounter, sincronizzazione e migrazione legacy.

#### Scenario: Sessione completa
- **WHEN** Master e due Player attraversano il flusso su almeno due scene
- **THEN** ogni client osserva la stessa scena attiva e soltanto le mutazioni confermate pertinenti al ruolo

#### Scenario: Riavvio P0.9
- **WHEN** il server viene riavviato dopo preparazione e modifiche live
- **THEN** catalogo, configurazione ed encounter preparati sono recuperati
- **AND** la verifica non richiede recovery automatico di round, movimento o runtime completo

#### Scenario: Compatibilità legacy
- **WHEN** una campagna legacy viene avviata e poi usa più scene
- **THEN** la board originaria compare una sola volta e i client continuano a funzionare

#### Scenario: Confine P0.10
- **WHEN** si verifica l'isolamento Player
- **THEN** si controllano i filtri correnti senza dichiarare completata la segretezza server-side
