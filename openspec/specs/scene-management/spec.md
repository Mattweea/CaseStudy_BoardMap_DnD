# Scene Management Specification

## Purpose

Definire il contratto condiviso, versionato e normalizzato delle scene, separando la configurazione preparata dallo stato live della sessione.

## Requirements

### Requirement: P0.9a.1 Modello di scena versionato e normalizzato
Il sistema SHALL rappresentare ogni scena con identificatore stabile, metadati, versione e documento JSON normalizzato, mantenendo sezioni distinte per background, configurazione board, disegni, elementi scenici, placement preparati, token runtime e riferimenti ad altre entità.

#### Scenario: Documento valido
- **WHEN** il server carica o riceve un documento scena valido
- **THEN** applica default e limiti canonici senza fondere disegni, elementi, placement e token

#### Scenario: Documento malformato
- **WHEN** un documento contiene identificatori duplicati, riferimenti invalidi, coordinate fuori limite o supera le soglie ammesse
- **THEN** il server lo rifiuta senza modificare stato o versione

#### Scenario: Confine configurazione e runtime
- **WHEN** durante il gioco cambiano movimento, HP, turno o round
- **THEN** P0.9a.1 non promuove automaticamente tali valori nella configurazione persistente né ne promette il recovery dopo riavvio

### Requirement: P0.9a.2 Persistenza e migrazione legacy delle scene
Il sistema SHALL conservare in SQLite catalogo, metadati, documento JSON e versione delle scene mediante migrazioni immutabili, repository dedicato e aggiornamenti con controllo della versione attesa.

#### Scenario: Riapertura del catalogo
- **WHEN** il server viene riavviato dopo la creazione o modifica di scene
- **THEN** catalogo, configurazioni e riferimento alla scena attiva persistiti sono nuovamente disponibili

#### Scenario: Conflitto di versione
- **WHEN** due mutazioni strutturali usano la stessa versione base
- **THEN** soltanto la prima avanza la versione e la seconda è rifiutata senza sovrascrivere dati

#### Scenario: Migrazione idempotente della board legacy
- **WHEN** il server parte senza scene persistite e trova uno stato board legacy valido
- **THEN** crea una sola scena iniziale con i campi supportati
- **AND** gli avvii successivi non duplicano né reimportano la scena

#### Scenario: Confine P0.11
- **WHEN** il server riparte dopo mutazioni esclusivamente live
- **THEN** P0.9a.2 recupera la configurazione persistita ma non promette il recovery automatico del runtime completo

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

### Requirement: P0.9a.4 Una sola scena attiva integrata con la board
Il sistema SHALL mantenere per la campagna una sola scena attiva e SHALL proiettarne configurazione e contenuti nella board e nello stato realtime corrente.

#### Scenario: Snapshot Player
- **WHEN** il server produce una vista HTTP o SSE per un Player
- **THEN** include soltanto identità e proiezione della scena attiva
- **AND** omette catalogo, documenti e asset delle scene inattive

#### Scenario: Snapshot Master
- **WHEN** il server produce una vista per il Master
- **THEN** include il catalogo autorizzato e la proiezione attiva senza incorporare tutti i documenti completi

#### Scenario: Compatibilità della board
- **WHEN** un consumer esistente legge token, luci, unità o flag board
- **THEN** riceve i valori derivati dalla scena attiva nella forma compatibile prevista dagli adapter

### Requirement: Dimensioni finite o illimitate della scena
La configurazione dimensionale della scena SHALL accettare una coppia di interi positivi entro i limiti consentiti oppure la coppia `0 × 0` per la modalità illimitata. Una coppia mista con un solo zero, valori negativi, non interi o fuori limite SHALL essere rifiutata senza mutare documento, versione o stato condiviso. Solo il Master autenticato SHALL poter salvare la configurazione, con la stessa protezione dai conflitti di versione delle altre modifiche della scena. Le scene legacy con dimensioni positive SHALL conservare tali valori.

#### Scenario: Salvataggio della modalità illimitata
- **WHEN** il Master salva `0 × 0` con una versione corrente
- **THEN** il server persiste entrambe le dimensioni a zero, incrementa la versione e distribuisce la configurazione ai client autorizzati

#### Scenario: Coppia mista non valida
- **WHEN** viene inviata una configurazione con zero colonne e un numero positivo di righe
- **THEN** il server rifiuta la richiesta senza cambiare scena o versione

#### Scenario: Accesso e concorrenza
- **WHEN** un Player o un Master con versione obsoleta tenta di modificare le dimensioni
- **THEN** il server rifiuta la mutazione e conserva la configurazione confermata

#### Scenario: Compatibilità
- **WHEN** viene caricata una scena precedente con dimensioni positive valide
- **THEN** il sistema conserva la board finita senza richiedere migrazione manuale
