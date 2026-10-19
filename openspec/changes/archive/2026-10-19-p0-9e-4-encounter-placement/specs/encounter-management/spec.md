## ADDED Requirements

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

## MODIFIED Requirements

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
