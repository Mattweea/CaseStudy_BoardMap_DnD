## Purpose

Presentare l'iniziativa condivisa già disponibile e avvisare il Player dell'avvicinarsi del proprio turno prima dell'integrazione con le schede.

## ADDED Requirements

### Requirement: Tracker del turno nella tab dedicata
La tab Turni di iniziativa SHALL mostrare le voci visibili al partecipante in ordine dal valore più alto al più basso, evidenziando il turno attivo e il round corrente quando il combattimento è avviato. Il Master SHALL mantenere i controlli di turno già disponibili.

#### Scenario: Ordine già impostato
- **WHEN** il Master ha impostato un ordine di iniziativa e avanza il turno
- **THEN** Master e Player vedono l'ordine e l'evidenziazione del turno aggiornarsi nella tab

#### Scenario: Nessuna iniziativa
- **WHEN** non esistono voci di iniziativa
- **THEN** la tab mostra uno stato vuoto comprensibile senza richiedere una scheda personale

### Requirement: Avvisi del Player alle transizioni
Quando il turno attivo immediatamente precedente al token del Player comincia, l'interfaccia SHALL mostrare «Sei il prossimo!». Quando comincia il turno del suo token, SHALL mostrare «Tocca a te!». Ogni avviso SHALL comparire una sola volta per transizione di turno, senza ripetersi per aggiornamenti di stato non correlati, e SHALL essere chiudibile e accessibile da tastiera.

#### Scenario: Turno precedente e turno proprio
- **WHEN** l'ordine passa al token immediatamente prima di quello del Player e poi al suo token
- **THEN** il Player vede prima «Sei il prossimo!» e poi «Tocca a te!», una volta per ciascuna transizione

#### Scenario: Snapshot ripetuto
- **WHEN** lo stato del combattimento viene aggiornato senza cambiare il turno attivo
- **THEN** l'avviso già mostrato non riappare

#### Scenario: Player senza voce di iniziativa
- **WHEN** il Player non ha un token presente nell'ordine visibile
- **THEN** non riceve gli avvisi «Sei il prossimo!» o «Tocca a te!»

### Requirement: Confine della logica P0.3
La presentazione SHALL usare l'ordine di iniziativa già disponibile senza richiedere il tiro dalla scheda, la scelta normale/vantaggio/svantaggio per l'iniziativa o nuove regole di inserimento manuale. Queste funzioni sono previste in P0.7.

#### Scenario: Sessione senza schede
- **WHEN** il Master usa il tracker esistente prima dell'introduzione delle schede
- **THEN** l'ordine e gli avvisi funzionano con i dati già presenti
