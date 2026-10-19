## ADDED Requirements

### Requirement: P0.9d.3 Runtime live distinto per scena
Il sistema SHALL mostrare e modificare soltanto i token live della scena attiva. Durante il processo SHALL conservare separatamente i token delle scene inattive, senza promettere il loro recupero dopo un riavvio.

#### Scenario: Cambio e ritorno
- **WHEN** il Master attiva una scena diversa e poi torna alla precedente
- **THEN** ogni scena mostra i propri token live, senza duplicare quelli dell'altra

#### Scenario: Login con token in altra scena
- **WHEN** un Player accede mentre il suo token canonico si trova in una scena inattiva
- **THEN** il login non crea un duplicato nella scena attiva

#### Scenario: Riavvio
- **WHEN** il processo viene riavviato senza un recupero esplicito dello stato live
- **THEN** la configurazione persistita delle scene resta disponibile, ma i loro token live precedenti non sono garantiti

### Requirement: P0.9d.3 Trasferimento atomico del party
Il sistema SHALL permettere al Master di selezionare una scena inattiva come destinazione e scegliere se attivarla soltanto oppure attivarla trasferendovi il party calcolato dal server dalla scena attualmente attiva. L'operazione combinata SHALL preservare identificatori e relazioni supportate oppure lasciare invariati sia la scena attiva sia i token di entrambe le scene.

#### Scenario: Preview
- **WHEN** il Master sceglie una destinazione inattiva e una cella ancora
- **THEN** il server calcola un layout deterministico valido dalla scena attiva alla destinazione senza modificare scena attiva o token

#### Scenario: Attivazione senza trasferimento
- **WHEN** il Master sceglie soltanto di attivare la destinazione
- **THEN** la scena diventa attiva e i token della sorgente rimangono nella loro scena

#### Scenario: Conferma combinata
- **WHEN** il Master conferma l'anteprima e tutti i footprint trovano spazio
- **THEN** la destinazione diventa attiva e roster token, familiari posseduti e veicoli occupati vi sono trasferiti in un unico commit logico e un solo aggiornamento realtime

#### Scenario: Fallimento
- **WHEN** versioni, spazio, round, persistenza dell'attivazione o un errore prima della pubblicazione impediscono il trasferimento
- **THEN** la scena attiva e i token di entrambe le scene restano invariati

#### Scenario: Identità
- **WHEN** il party viene trasferito
- **THEN** ID, ownership e relazioni veicolo/familiare supportate sono preservati
