## ADDED Requirements

### Requirement: Modale di modifica del token nascosta

La modale di modifica di un token SHALL NOT essere raggiungibile da alcuna superficie della GUI, per nessun ruolo:

- click destro o doppio click su un token o su un gruppo di token sulla mappa;
- click destro su una voce della tab Turni di iniziativa;
- comando di modifica nell'elenco degli elementi in mappa;
- voce del menu radiale del token.

Le modifiche ai dati di un personaggio SHALL passare dalla sua scheda; le condizioni SHALL passare dal menu radiale. Il codice della modale SHALL restare nel progetto, pronto per essere riesposto da una capability successiva. Nascondere la modale SHALL NOT cambiare le autorizzazioni del server: le vie di scrittura esistenti restano soggette agli stessi controlli.

#### Scenario: Doppio click sul proprio token

- **WHEN** un Adventurer fa doppio click sul proprio token
- **THEN** nessuna modale di modifica si apre

#### Scenario: Master sul token di un nemico

- **WHEN** il Master fa doppio click su un token nemico o click destro sulla sua voce nella tab Turni di iniziativa
- **THEN** nessuna modale di modifica si apre

#### Scenario: Elenco degli elementi

- **WHEN** il Master apre l'elenco degli elementi in mappa
- **THEN** le righe non offrono un comando di modifica
