## ADDED Requirements

### Requirement: Tiro libero equo con dettaglio per-dado compatibile

Ogni tiro libero accettato SHALL essere risolto dal motore autorevole equo e SHALL aggiungere al log il dettaglio di tutti i dadi generati con identità, facce, valore, gruppo e disposizione. I campi esistenti `rolls`, `keptRolls`, `modifier` e `total` SHALL restare coerenti con quel dettaglio e disponibili per i client e gli snapshot compatibili. Un dettaglio per-dado assente in uno snapshot precedente SHALL essere accettato come formato legacy; un dettaglio presente ma malformato SHALL essere ignorato senza trasformare dati non validi in un risultato autorevole.

#### Scenario: Tiro normale con più dadi

- **WHEN** un partecipante esegue `2d6+1`
- **THEN** risposta e aggiornamento di stato contengono due dadi `kept` distinti e i campi aggregati riportano gli stessi valori e lo stesso totale

#### Scenario: Tiro con vantaggio

- **WHEN** un partecipante esegue `1d20` con vantaggio
- **THEN** risposta e aggiornamento di stato contengono due d20, uno `kept` e uno `discarded`, e `keptRolls` e `total` corrispondono al dado tenuto

#### Scenario: Snapshot precedente alla change

- **WHEN** il server carica una voce di log valida che contiene i campi aggregati ma non il dettaglio per-dado
- **THEN** conserva la voce compatibile senza inventare identità o disposizioni mancanti

#### Scenario: Privacy del dettaglio per-dado

- **WHEN** un Player non destinatario riceve stato o aggiornamenti dopo un tiro segreto altrui
- **THEN** non riceve né il log né alcuna voce del relativo dettaglio per-dado
