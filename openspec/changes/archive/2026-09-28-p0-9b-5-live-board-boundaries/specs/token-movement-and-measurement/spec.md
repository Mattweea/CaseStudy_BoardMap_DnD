# Spec Delta

## ADDED Requirements

### Requirement: Interazioni sulla board illimitata
Sulla board `0 × 0`, righello, sagome e movimento SHALL usare le stesse caselle, unità, costi, controlli di autorizzazione e visibilità della board finita. L'assenza del bordo di righe e colonne SHALL NOT disabilitare la validazione server di coordinate, percorso, ostacoli, occupazione e budget. Una coordinata negativa o non valida SHALL essere rifiutata; nessun singolo percorso SHALL poter imporre elaborazione non limitata al server.

#### Scenario: Movimento oltre il precedente confine
- **WHEN** un partecipante autorizzato conferma un percorso valido oltre le vecchie dimensioni finite di una scena ora illimitata
- **THEN** il server lo accetta applicando le normali regole di movimento e i client autorizzati vedono la nuova posizione

#### Scenario: Coordinate non valide
- **WHEN** un client invia una destinazione negativa o non valida su una board illimitata
- **THEN** il server rifiuta il movimento senza modificare posizione o budget

#### Scenario: Percorso eccessivo
- **WHEN** un client invia un percorso che supera i limiti di elaborazione consentiti
- **THEN** il server lo rifiuta senza modificare posizione o budget
