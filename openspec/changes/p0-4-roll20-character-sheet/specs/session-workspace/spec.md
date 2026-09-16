## MODIFIED Requirements

### Requirement: Roster e collegamento alla mappa

La tab Personaggi SHALL mostrare i profili del roster disponibili con nome e ritratto corrente e SHALL permettere di localizzare il token associato quando esiste. Un Adventurer autenticato SHALL poter aprire la propria scheda dalla tab e SHALL NOT poter aprire la scheda degli altri Adventurer; il Master SHALL poter aprire ogni scheda della campagna.

#### Scenario: Personaggio con token

- **WHEN** un partecipante seleziona un personaggio del roster con token presente sulla mappa
- **THEN** l'interfaccia rende disponibile l'azione per localizzare quel token

#### Scenario: Profilo senza token

- **WHEN** il roster comprende un profilo senza token nella scena
- **THEN** il profilo resta elencato e l'interfaccia non presenta un'azione di localizzazione inutilizzabile

#### Scenario: Adventurer apre la propria scheda

- **WHEN** un Adventurer seleziona il proprio profilo nella tab Personaggi
- **THEN** l'interfaccia rende disponibile l'apertura della propria scheda modificabile

#### Scenario: Adventurer vede il profilo altrui

- **WHEN** un Adventurer visualizza il profilo di un altro Adventurer
- **THEN** vede i soli dati pubblici del roster e non può aprirne la scheda

#### Scenario: Master apre una scheda

- **WHEN** il Master seleziona il profilo di un Adventurer
- **THEN** l'interfaccia rende disponibile l'apertura della scheda completa e modificabile

#### Scenario: Ritratto aggiornato

- **WHEN** il proprietario o il Master sostituisce il ritratto di una scheda
- **THEN** la tab Personaggi mostra il nuovo ritratto senza richiedere un ricaricamento della pagina
