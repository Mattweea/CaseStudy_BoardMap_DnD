# Encounter Management Specification

## Purpose

Consente al Master di preparare e gestire encounter associati alle scene, inclusi incontri narrativi e di combattimento, senza avviare automaticamente il combattimento.

## Requirements

### Requirement: P0.9e.1 Lifecycle degli encounter associati alla scena
Il sistema SHALL consentire al Master di creare, elencare, leggere, modificare e rimuovere encounter associati a una scena mediante mutazioni autorizzate e versionate. Un encounter SHALL poter rappresentare combattimento, narrazione o altra situazione supportata senza avviare automaticamente il combattimento.

#### Scenario: Encounter narrativo
- **WHEN** il Master crea un encounter narrativo valido
- **THEN** compare nella scena senza cambiare sessionMode o iniziativa

#### Scenario: Modifica concorrente
- **WHEN** due modifiche usano la stessa versione base
- **THEN** la seconda è rifiutata senza sovrascrivere la prima

#### Scenario: Rimozione referenziata
- **WHEN** il Master tenta di rimuovere un encounter con placement collegati
- **THEN** il server rifiuta finché i placement non sono rimossi esplicitamente

#### Scenario: Player
- **WHEN** un Player invia una mutazione encounter
- **THEN** il server la rifiuta per autorizzazione

### Requirement: P0.9e.2 Entità mostro e PNG senza modelli duplicati
Il sistema SHALL consentire al Master di associare a un encounter entità mostro, PNG o entrambe con identificatori stabili e mutazioni versionate. SHALL rendere tali entità proiettabili nel modello token esistente, senza creare una seconda rappresentazione runtime o collocarle automaticamente sulla board.

#### Scenario: Encounter misto
- **WHEN** il Master aggiunge un mostro e un PNG allo stesso encounter
- **THEN** restano distinguibili tramite riferimenti stabili e possono essere usati da placement indipendenti

#### Scenario: Adapter token
- **WHEN** una futura operazione di placement richiede la proiezione di un'entità valida
- **THEN** l'adapter produce identificatore, geometria, movimento e proprietà compatibili con UnitToken senza un secondo motore token

#### Scenario: Combattimento opzionale
- **WHEN** un token derivato viene aggiunto esplicitamente al runtime e il Master avvia il combattimento
- **THEN** può usare il tracker e lifecycle esistenti, anche senza scheda completa; la definizione dell'entità non avvia il combattimento né aggiunge iniziativa

#### Scenario: Nessuna scheda PC implicita
- **WHEN** viene creata un'entità monster o npc
- **THEN** non viene creata automaticamente una scheda personaggio giocante

#### Scenario: Autorizzazione e concorrenza
- **WHEN** un Player tenta di modificare le entità o il Master usa una versione obsoleta della scena
- **THEN** la mutazione viene rifiutata senza alterare l'encounter

### Requirement: P0.9e.3 Dati minimi distinti per mostri e PNG
Il sistema SHALL permettere al Master di creare e modificare manualmente le entità monster e npc di un encounter, conservando soltanto i dati necessari alla loro identificazione e preparazione nel modello corrente, senza assumere che usino la scheda di un personaggio giocante. Le entità e i loro dati SHALL restare nella preparazione privata della scena finché un'operazione distinta non le colloca sulla board.

#### Scenario: Entità senza scheda
- **WHEN** il Master crea un mostro o PNG con i campi minimi validi
- **THEN** può prepararlo e proiettarlo come token senza creare una scheda PC

#### Scenario: Modifica manuale
- **WHEN** il Master modifica i dati minimi di un'entità già associata a un encounter
- **THEN** la scena conserva l'identificatore stabile dell'entità e salva i nuovi dati con controllo di versione, senza collocare nuove istanze
- **AND** le istanze già collocate ricevono soltanto le proprietà iniziali cambiate, mantenendo gli altri valori live

#### Scenario: Nessun catalogo disponibile
- **WHEN** il Master prepara un mostro o PNG in P0.9e.3
- **THEN** usa dati manuali locali all'encounter, senza un collegamento non verificabile a un catalogo di creature; una sorgente canonica richiederà un change separato

#### Scenario: Autorizzazione e conflitto
- **WHEN** un Player tenta di modificare i dati di un'entità o il Master invia una versione obsoleta della scena
- **THEN** la mutazione viene rifiutata senza cambiare l'entità

#### Scenario: Nessuna importazione esterna
- **WHEN** il Master gestisce i dati in P0.9e.3
- **THEN** l'applicazione non interroga 5e.tools né altre sorgenti esterne

#### Scenario: Campi non necessari
- **WHEN** un dato non è richiesto da identificazione, preparazione o adapter UnitToken corrente
- **THEN** P0.9e.3 non lo aggiunge come requisito di una scheda mostro

### Requirement: P0.9e.4 Placement e preparazione degli encounter
Il sistema SHALL permettere al Master di creare placement sulla scena per le entità di un encounter, mantenendoli distinti dagli elementi scenici e rappresentando almeno posizione, trasformazione supportata e stato di preparazione/visibilità.

#### Scenario: Placement preparato
- **WHEN** il Master colloca un'entità valida
- **THEN** il placement conserva il collegamento a encounter/entity e può essere proiettato come UnitToken

#### Scenario: Separazione dagli elementi
- **WHEN** il Master seleziona un placement
- **THEN** vede proprietà entità/token e non i controlli della libreria scenica

#### Scenario: Nascosto corrente
- **WHEN** il Master prepara l'entità come non visibile
- **THEN** la proiezione applica lo stato di visibilità e la sanitizzazione correnti

#### Scenario: Confine P0.10
- **WHEN** un placement è nascosto o preparato
- **THEN** P0.9e.4 non garantisce che ogni dato correlato sia escluso dal client Player

#### Scenario: Autorizzazione e concorrenza
- **WHEN** un Player tenta una mutazione placement o il Master usa una versione obsoleta della scena
- **THEN** l'operazione viene rifiutata senza cambiare preparazione o token live

#### Scenario: Scrittura non riuscita
- **WHEN** il placement non rispetta riferimenti, ingombri o collisioni, oppure la persistenza rifiuta la scrittura
- **THEN** configurazione, versione e runtime restano invariati

#### Scenario: Preparazione distinta dal gioco
- **WHEN** un token derivato viene mosso o perde HP durante il gioco e successivamente viene modificata una proprietà estranea alla preparazione dell'istanza
- **THEN** il token mantiene i propri valori live senza sovrascrivere la configurazione preparata

### Requirement: P0.9e.5 Persistenza della configurazione encounter
Il sistema SHALL persistere encounter, entità e placement preparati come configurazione versionata associata alla scena, senza includere automaticamente lo stato live completo della sessione.

#### Scenario: Riapertura
- **WHEN** il server viene riavviato dopo la configurazione
- **THEN** definizione, entità e placement preparati sono nuovamente disponibili al Master

#### Scenario: Stato live escluso
- **WHEN** durante la sessione cambiano round, turno, HP, condizioni o posizione live dei token derivati
- **THEN** P0.9e.5 non promette che tali cambi siano recuperati automaticamente dopo il riavvio

#### Scenario: Commit coerente
- **WHEN** una mutazione encounter viene accettata
- **THEN** la versione scena avanza una sola volta e il documento resta privo di riferimenti orfani

#### Scenario: Errore di persistenza
- **WHEN** SQLite rifiuta la scrittura
- **THEN** configurazione, versione e proiezione in memoria restano invariate
