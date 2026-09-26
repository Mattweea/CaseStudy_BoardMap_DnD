## ADDED Requirements

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
