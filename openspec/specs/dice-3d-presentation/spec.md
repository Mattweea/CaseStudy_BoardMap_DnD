# Dice 3D Presentation Specification

## Purpose

Rendere ogni nuovo tiro autorizzato un evento visivo sulla mappa, animando in 3D gli esiti già decisi dal server senza alterare logica, privacy o usabilità della sessione.

## Requirements

### Requirement: Animazione fedele al risultato autorevole

Il client SHALL animare sopra la superficie della mappa ogni nuovo log visibile che contiene un dettaglio per-dado valido. L'animazione SHALL usare esclusivamente facce predeterminate dai valori autorevoli e SHALL mostrare, per ogni dado logico, lo stesso esito registrato nel log. Il completamento, l'interruzione o il fallimento della presentazione SHALL NOT modificare risultato, totale, log o effetti collaterali già applicati.

#### Scenario: Tiro libero animato

- **WHEN** un partecipante riceve un nuovo log valido per `2d6+1` con risultati naturali `2` e `5`
- **THEN** vede due d6 rotolare sulla mappa e fermarsi rispettivamente su `2` e `5`, mentre il log conserva immediatamente totale e modificatore autorevoli

#### Scenario: Tiro originato dalla scheda

- **WHEN** un partecipante riceve un nuovo tiro da un bersaglio della scheda
- **THEN** l'animazione usa lo stesso dettaglio per-dado del log senza ricostruire la formula dai campi della scheda

### Requirement: Dadi multipli, percentile e disposizione leggibile

La presentazione SHALL includere tutti i dadi autorevoli di una voce entro il limite supportato e SHALL mantenere riconoscibili i gruppi logici. Un d100 logico SHALL essere rappresentato mediante due modelli percentile coordinati la cui lettura corrisponde al valore `1..100`, compresi `100`, i multipli di dieci e i valori inferiori a dieci, senza aggiungere dadi al contratto autorevole. Al termine del tiro, i dadi `kept` SHALL essere evidenziati, i `discarded` SHALL risultare attenuati e gli `unresolved` SHALL restare neutri e paritari.

#### Scenario: Vantaggio o svantaggio

- **WHEN** un tiro contiene due d20 con uno `kept` e uno `discarded`
- **THEN** entrambi rotolano sul proprio valore e, una volta fermi, il risultato tenuto è in evidenza mentre quello scartato è attenuato

#### Scenario: Coppia non risolta della scheda

- **WHEN** un tiro della scheda contiene due d20 entrambi `unresolved`
- **THEN** entrambi rotolano e restano presentati con pari enfasi, senza inventare una scelta del server

#### Scenario: Casi limite percentile

- **WHEN** il log contiene un d100 con valore `7`, `40` oppure `100`
- **THEN** la coppia percentile mostra rispettivamente `07`, `40` oppure `00` interpretato come `100`

#### Scenario: Danno con più gruppi

- **WHEN** un tiro di danno contiene dadi appartenenti a due gruppi logici
- **THEN** tutti i dadi rotolano nella stessa presentazione e il riepilogo finale conserva distinguibili i due gruppi

### Requirement: Una sola animazione per nuovo log visibile

Il client SHALL deduplicare i tiri per id di log e serializzare in ordine di arrivo le animazioni visibili. Lo stato iniziale, un aggiornamento completo dopo riconnessione e i log legacy già presenti SHALL stabilire una baseline senza rianimare la cronologia. Un tiro pubblico SHALL animarsi su ciascun client che lo riceve; un tiro segreto SHALL animarsi soltanto sui client ai quali il server consegna il relativo log.

#### Scenario: Due tiri ravvicinati

- **WHEN** due nuovi log animabili arrivano mentre il primo tiro è ancora in corso
- **THEN** il secondo resta in coda e parte una sola volta dopo il completamento del primo

#### Scenario: Primo caricamento con cronologia

- **WHEN** un client apre o ricarica la sessione e lo snapshot iniziale contiene log precedenti
- **THEN** nessun tiro storico viene animato

#### Scenario: Tiro pubblico condiviso

- **WHEN** un nuovo tiro pubblico viene consegnato a due partecipanti collegati
- **THEN** ciascun client lo anima una sola volta a partire dallo stesso risultato autorevole

#### Scenario: Tiro segreto non consegnato

- **WHEN** un Player non destinatario non riceve il log di un tiro segreto
- **THEN** sul suo client non viene accodata né mostrata alcuna animazione relativa a quel tiro

### Requirement: Overlay non bloccante e fallback numerico

La scena SHALL essere trasparente agli eventi del puntatore e SHALL NOT sottrarre il focus, impedire l'uso di mappa, pannello o scheda, né cambiare coordinate, zoom o disposizione della board. Il client SHALL evitare l'animazione e mantenere il solo risultato numerico quando è attiva la preferenza di sistema per movimento ridotto, WebGL non è disponibile, il dettaglio per-dado è assente o non animabile, il numero di dadi supera il limite previsto oppure inizializzazione/esecuzione falliscono. Un errore della scena SHALL NOT interrompere la coda né produrre un errore bloccante per l'utente.

#### Scenario: Interazione durante il tiro

- **WHEN** i dadi stanno rotolando sopra la mappa
- **THEN** il partecipante può continuare a usare controlli, scheda e interazioni della board e il focus corrente resta invariato

#### Scenario: Movimento ridotto o WebGL assente

- **WHEN** il sistema richiede movimento ridotto oppure il browser non può creare la scena WebGL
- **THEN** nessuna animazione parte, il risultato numerico resta disponibile e l'applicazione continua senza mostrare un errore

#### Scenario: Log legacy o errore del renderer

- **WHEN** un nuovo log non contiene dettaglio per-dado utilizzabile oppure il renderer non riesce a inizializzarsi o completare il tiro
- **THEN** il client conserva il log numerico, considera gestito quell'id e può elaborare i tiri successivi

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
