## MODIFIED Requirements

### Requirement: Tracker del turno nella tab dedicata

La tab Turni di iniziativa SHALL mostrare la modalità della sessione e le voci visibili al partecipante nell'ordine autorevole stabilito dal server, dal più veloce al più lento salvo gli spostamenti imposti dal Master, evidenziando il turno attivo e il round corrente quando il round è avviato. Durante la fase di tiro SHALL indicare che il round non è ancora cominciato. La tab SHALL offrire a ogni partecipante il tiro d'iniziativa per i token che è autorizzato a tirare, solo quando il tiro verrebbe accettato. Il Master SHALL disporre in questa tab dei comandi per entrare e uscire dal Combattimento, avviare il round 1, avanzare e arretrare il turno, scegliere il turno attivo, tirare per un token o per tutti, inserire un valore manuale, spostare e rimuovere voci. Gli Adventurer SHALL NOT vedere i comandi riservati al Master. Il valore mostrato di ogni voce SHALL essere il totale intero, senza la frazione di spareggio.

#### Scenario: Ordine già impostato

- **WHEN** il Master ha impostato un ordine di iniziativa e avanza il turno
- **THEN** Master e Player vedono l'ordine e l'evidenziazione del turno aggiornarsi nella tab

#### Scenario: Nessuna iniziativa

- **WHEN** non esistono voci di iniziativa
- **THEN** la tab mostra uno stato vuoto comprensibile, che in Esplorazione spiega che il tiro si abilita quando il Master avvia il combattimento

#### Scenario: Tiro dalla tab

- **WHEN** in fase di tiro un Adventurer apre la tab senza avere ancora una voce
- **THEN** trova il comando per tirare l'iniziativa del proprio personaggio e, dopo il tiro, vede la propria voce al posto che le spetta

#### Scenario: Comandi riservati

- **WHEN** un Adventurer apre la tab durante il combattimento
- **THEN** non vede i comandi per avanzare il turno, riordinare, inserire o rimuovere voci

### Requirement: Avvisi del Player alle transizioni

Quando il turno attivo immediatamente precedente al token del Player comincia, l'interfaccia SHALL mostrare «Sei il prossimo!» con un effetto sonoro. Quando comincia il turno del suo token, SHALL mostrare «Tocca a te!» con un effetto sonoro distinto. Gli avvisi e i loro suoni SHALL raggiungere solo il Player interessato. Ogni avviso SHALL comparire una sola volta per transizione di turno, senza ripetersi per aggiornamenti di stato non correlati, e SHALL essere chiudibile e accessibile da tastiera. Il suono SHALL rispettare le preferenze audio di combattimento del Player, e l'avviso visivo SHALL comparire anche quando il suono è silenziato o non riproducibile.

#### Scenario: Turno precedente e turno proprio

- **WHEN** l'ordine passa al token immediatamente prima di quello del Player e poi al suo token
- **THEN** il Player vede e sente prima «Sei il prossimo!» e poi «Tocca a te!», una volta per ciascuna transizione

#### Scenario: Snapshot ripetuto

- **WHEN** lo stato del combattimento viene aggiornato senza cambiare il turno attivo
- **THEN** l'avviso già mostrato non riappare e il suono non si ripete

#### Scenario: Player senza voce di iniziativa

- **WHEN** il Player non ha un token presente nell'ordine visibile
- **THEN** non riceve gli avvisi «Sei il prossimo!» o «Tocca a te!»

#### Scenario: Avviso riservato

- **WHEN** comincia il turno del personaggio di un Player
- **THEN** né il Master né gli altri Player vedono o sentono «Tocca a te!»

## REMOVED Requirements

### Requirement: Confine della logica P0.3

**Reason**: il confine rinviava a P0.8 il tiro dalla scheda, la scelta della modalità e l'inserimento manuale in qualunque posizione, che ora sono definiti dalla capability `initiative-rolling`.

**Migration**: nessuna azione sui dati. Le regole di tiro, modalità, ordinamento e inserimento sono in `initiative-rolling`; il ciclo di vita dell'incontro è in `combat-session-mode`.
