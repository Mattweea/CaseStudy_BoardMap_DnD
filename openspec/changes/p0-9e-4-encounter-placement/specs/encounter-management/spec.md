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
