## ADDED Requirements

### Requirement: Camera locale che accompagna il PG in movimento

Quando un movimento confermato porta il PG seguito oltre uno dei bordi effettivamente visibili, la mappa SHALL spostare la camera locale del minimo necessario a renderne visibile l'ingombro, compatibilmente con i limiti della scena e con lo spazio disponibile. Se l'ingombro è più grande della viewport, la camera SHALL mantenerne visibile il centro. Il Player SHALL seguire il proprio PG canonico; il Master SHALL seguire il PG selezionato singolarmente. La camera SHALL accompagnare la posizione mostrata durante una camminata confermata, senza saltare preventivamente alla destinazione.

La camera SHALL restare ferma se il PG rimane visibile e SHALL consentire il pan manuale quando il PG non sta avanzando. Il comportamento SHALL funzionare con zoom diversi, pannello aperto o chiuso, vista normale o fullscreen, scene finite o illimitate e PG trasportato da un veicolo. La camera SHALL restare locale e SHALL NOT modificare zoom, coordinate dei token, stato condiviso o viste degli altri partecipanti tramite un comando di centratura remota.

#### Scenario: Superamento di un bordo
- **WHEN** il PG seguito avanza oltre il bordo destro, sinistro, superiore o inferiore dell'area effettivamente visibile
- **THEN** la camera scorre quanto basta per mantenerlo visibile, senza modificare lo zoom

#### Scenario: Movimento dentro la viewport
- **WHEN** il PG seguito si muove mantenendo tutto il proprio ingombro nell'area visibile
- **THEN** la camera resta nella posizione corrente

#### Scenario: Seguito durante la camminata
- **WHEN** un percorso confermato supera un bordo prima di raggiungere la destinazione
- **THEN** la visuale accompagna il PG mentre cammina invece di spostarsi subito sulla destinazione finale

#### Scenario: Ruoli e bersaglio
- **WHEN** un Player muove il proprio PG oppure il Master muove il PG selezionato singolarmente
- **THEN** la rispettiva visuale accompagna quel PG e il movimento di un token diverso non cambia il bersaglio seguito

#### Scenario: PG in veicolo
- **WHEN** un veicolo trasporta il PG seguito oltre il bordo visibile
- **THEN** la camera segue la posizione mostrata del PG trasportato anche durante l'animazione del veicolo

#### Scenario: Pan manuale con PG fermo
- **WHEN** il partecipante sposta manualmente la visuale mentre il PG è fermo
- **THEN** la camera mantiene la posizione scelta fino a un nuovo avanzamento del PG o a una localizzazione esplicita

#### Scenario: Movimento annullato o rifiutato
- **WHEN** il partecipante prepara un percorso, lo annulla oppure il server rifiuta la richiesta di movimento
- **THEN** il solo tentativo non attiva lo scorrimento automatico

#### Scenario: Vista, zoom e limiti della scena
- **WHEN** il PG supera il bordo con una diversa larghezza del pannello, uno zoom diverso o la mappa in fullscreen
- **THEN** la camera usa l'area realmente visibile in quella vista e rispetta i confini della scena finita oppure l'origine non negativa e i limiti di coordinate della scena illimitata

#### Scenario: Ingombro maggiore dello spazio disponibile
- **WHEN** il PG seguito è più grande dell'area visibile lungo un asse
- **THEN** la camera rende visibile il suo centro lungo quell'asse senza oscillare tra i due bordi

#### Scenario: Cambio scena e riconnessione
- **WHEN** cambia la scena attiva oppure il client si riconnette
- **THEN** un evento di movimento della scena precedente o già consumato non sposta la camera e il normale reset di scena resta applicabile
