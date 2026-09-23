## ADDED Requirements

### Requirement: Interruzione immediata della presentazione

Durante una presentazione 3D attiva il partecipante SHALL poter terminare immediatamente il tiro corrente premendo `Esc` oppure effettuando un click primario. L'interruzione SHALL ripulire la scena e l'eventuale attesa del riepilogo senza modificare il log o il risultato autorevole, SHALL NOT impedire l'azione normalmente associata al click o al tasto e SHALL consentire alla coda di proseguire con il tiro successivo.

#### Scenario: Salto con Escape durante il tiro

- **WHEN** un dado sta rotolando e il partecipante preme `Esc`
- **THEN** la presentazione corrente termina subito, il risultato numerico resta invariato e l'eventuale tiro successivo può iniziare

#### Scenario: Click non bloccante durante il tiro

- **WHEN** un dado sta rotolando e il partecipante effettua un click primario su un controllo utilizzabile dell'applicazione
- **THEN** la presentazione corrente termina senza annullare né ritardare l'azione richiesta su quel controllo

#### Scenario: Salto durante il riepilogo finale

- **WHEN** i dadi sono fermi e il riepilogo finale è ancora visibile
- **THEN** `Esc` o un click primario chiude subito la presentazione e libera la coda

### Requirement: Preferenze personali persistenti dei dadi 3D

Il client SHALL offrire a ogni partecipante controlli separati per abilitare o disabilitare l'animazione 3D e il relativo audio. Le preferenze SHALL essere locali al browser, SHALL persistere dopo ricaricamento e riavvio del client e SHALL NOT entrare nello stato condiviso né modificare l'esperienza degli altri partecipanti. In assenza di una preferenza valida, l'animazione SHALL restare abilitata per compatibilità con P0.6b e l'audio SHALL essere abilitato subordinatamente all'interazione utente.

#### Scenario: Animazione disabilitata localmente

- **WHEN** un partecipante disabilita l'animazione 3D e riceve un nuovo tiro animabile
- **THEN** vede subito il solo risultato numerico, mentre gli altri client applicano le proprie preferenze indipendenti

#### Scenario: Preferenze ripristinate dopo il riavvio

- **WHEN** un partecipante modifica le preferenze, ricarica o riapre l'applicazione nello stesso browser
- **THEN** i controlli e i tiri successivi rispettano i valori precedentemente salvati

#### Scenario: Disabilitazione durante una presentazione

- **WHEN** un partecipante disabilita l'animazione mentre un tiro è in corso o altri tiri attendono in coda
- **THEN** la presentazione corrente termina, i tiri già accodati degradano al risultato numerico e i nuovi tiri non inizializzano la scena finché la preferenza resta disabilitata

#### Scenario: Audio disabilitato indipendentemente

- **WHEN** l'animazione è abilitata ma il partecipante disabilita l'audio
- **THEN** i tiri continuano ad animarsi senza riprodurre suoni e senza influenzare gli altri client

### Requirement: Audio locale subordinato al consenso implicito del browser

Quando animazione e audio sono abilitati, il client SHALL riprodurre i suoni dei dadi esclusivamente dopo una reale interazione dell'utente con la pagina. Prima di tale interazione, oppure quando il browser nega o non supporta la riproduzione, il tiro SHALL restare silenzioso e l'animazione, il log e la coda SHALL continuare senza errori bloccanti. Un'abilitazione successiva SHALL valere soltanto per i tiri futuri e SHALL NOT riprodurre retroattivamente suoni di tiri già conclusi.

#### Scenario: Primo tiro prima dell'interazione

- **WHEN** un nuovo tiro arriva prima che il partecipante abbia interagito con la pagina
- **THEN** il tiro viene presentato senza audio e senza richieste invasive o errori visibili

#### Scenario: Tiro successivo a un'interazione

- **WHEN** il partecipante ha interagito con la pagina e le preferenze di animazione e audio sono abilitate
- **THEN** un tiro futuro riproduce il feedback sonoro locale durante la presentazione

#### Scenario: Riproduzione audio non disponibile

- **WHEN** il browser rifiuta o non riesce a riprodurre un suono del dado
- **THEN** la presentazione visiva e la coda proseguono, mentre il risultato numerico resta disponibile e invariato
