# Multi-Scene Session Specification

## Purpose

Definire il comportamento autorevole, realtime e coerente delle sessioni che attraversano più scene, incluse attivazione, isolamento e transizioni condivise.

## Requirements

### Requirement: P0.9d.1 Transizione realtime della scena attiva
Il sistema SHALL consentire soltanto al Master di attivare una scena e SHALL distribuire atomicamente la nuova proiezione a tutti i client connessi. Il server SHALL rifiutare il cambio mentre un round di combattimento è attivo.

#### Scenario: Cambio in Dungeon
- **WHEN** il Master attiva una scena in Dungeon e nessun round è attivo
- **THEN** tutti i client ricevono la nuova identità e proiezione senza ricaricare

#### Scenario: Cambio in roll phase
- **WHEN** il Master cambia scena in Combattimento prima dell'avvio del round
- **THEN** il server attiva la scena e azzera tracker e riferimenti incompatibili prima del broadcast

#### Scenario: Round attivo
- **WHEN** il Master tenta il cambio mentre un round è attivo
- **THEN** il server rifiuta e tutti i client restano sulla scena corrente

#### Scenario: Adventurer
- **WHEN** un Adventurer tenta di attivare una scena
- **THEN** il server rifiuta per autorizzazione

### Requirement: P0.9d.2 Isolamento dei Player sulla scena attiva
Il sistema SHALL accettare dai Player soltanto operazioni riferite alla scena attiva e SHALL omettere dalle loro viste catalogo, documenti e asset delle scene inattive, applicando la sanitizzazione già prevista dall'architettura corrente.

#### Scenario: Mutazione inattiva
- **WHEN** un Player invia una mutazione per una scena non attiva o una versione precedente
- **THEN** il server la rifiuta senza modificare alcuna scena

#### Scenario: Cambio con interazione in corso
- **WHEN** il client riceve un activeSceneId differente
- **THEN** azzera camera, selezione, percorso, righello, sagoma, ping e code effimere precedenti

#### Scenario: Contenuti inattivi
- **WHEN** il server produce una vista Player
- **THEN** catalogo, documenti e asset delle scene inattive sono omessi

#### Scenario: Confine P0.10
- **WHEN** il Player riceve la proiezione sanitizzata della scena attiva
- **THEN** P0.9d.2 non garantisce il filtraggio completo di ogni segreto o dato oltre il fog

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
