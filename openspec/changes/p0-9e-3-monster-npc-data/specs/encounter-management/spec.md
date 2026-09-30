## ADDED Requirements

### Requirement: P0.9e.3 Dati minimi distinti per mostri e PNG
Il sistema SHALL permettere al Master di creare e modificare manualmente le entità monster e npc di un encounter, conservando soltanto i dati necessari alla loro identificazione e preparazione nel modello corrente, senza assumere che usino la scheda di un personaggio giocante. Le entità e i loro dati SHALL restare nella preparazione privata della scena finché un'operazione distinta non le colloca sulla board.

#### Scenario: Entità senza scheda
- **WHEN** il Master crea un mostro o PNG con i campi minimi validi
- **THEN** può prepararlo e proiettarlo come token senza creare una scheda PC

#### Scenario: Modifica manuale
- **WHEN** il Master modifica i dati minimi di un'entità già associata a un encounter
- **THEN** la scena conserva l'identificatore stabile dell'entità e salva i nuovi dati con controllo di versione, senza creare o modificare un token live

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
