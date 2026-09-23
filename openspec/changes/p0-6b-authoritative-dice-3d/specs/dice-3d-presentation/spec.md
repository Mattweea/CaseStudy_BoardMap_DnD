## Purpose

Rendere ogni nuovo tiro autorizzato un evento visivo sulla mappa, animando in 3D gli esiti già decisi dal server senza alterare logica, privacy o usabilità della sessione.

## ADDED Requirements

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
