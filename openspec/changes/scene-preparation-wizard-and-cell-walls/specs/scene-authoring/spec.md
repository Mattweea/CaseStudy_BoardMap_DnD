# Spec Delta

## ADDED Requirements

### Requirement: Pareti strutturali a celle

Il Master SHALL poter dipingere pareti su celle intere tramite pennello e rettangolo e cancellarne celle con una gomma selettiva. Un trascinamento del pennello SHALL riempire anche le celle attraversate fra due posizioni campionate; il rettangolo SHALL riempire l'area inclusa fra gli estremi. Ripassare una cella SHALL NOT duplicarla. Ogni gesto completato SHALL produrre al massimo una scrittura versionata; Escape, perdita del gesto o cambio di strumento SHALL scartare il gesto incompleto. Celle negative, fuori dalla board finita o oltre i limiti consentiti SHALL essere rifiutate senza salvataggi parziali. L'interfaccia SHALL offrire anche un percorso da tastiera per aggiungere o rimuovere celle e definire un rettangolo.

#### Scenario: Pennellata continua

- **WHEN** il Master trascina velocemente il pennello su una fila di celle e rilascia
- **THEN** tutte le celle attraversate diventano parete con una sola scrittura e senza duplicati

#### Scenario: Rettangolo e cancellazione selettiva

- **WHEN** il Master disegna un rettangolo e cancella una delle sue celle con la gomma pareti
- **THEN** il rettangolo viene riempito e la gomma rimuove soltanto la cella strutturale indicata, conservando immagine, disegni, tracciati, elementi e token sovrapposti

#### Scenario: Gesto annullato o fuori limite

- **WHEN** il Master annulla un gesto oppure conferma un insieme contenente coordinate non ammesse
- **THEN** nessuna delle celle del gesto viene salvata e la geometria precedente resta valida

#### Scenario: Controllo da tastiera

- **WHEN** il Master usa i controlli da tastiera per indicare una cella o gli estremi di un rettangolo e conferma l'operazione
- **THEN** ottiene la stessa geometria di un gesto equivalente sulla preview

### Requirement: Pareti continue e blocchi coerenti

Le celle strutturali adiacenti per lato SHALL apparire come una parete continua senza bordi interni nella preview e nella board normale e fullscreen. SHALL contribuire al blocco di movimento, luce, visuale e scurovisione con le stesse celle sul client e sul server, preservando le eccezioni di movimento correnti di Master e veicoli. Un'apertura reale SHALL mantenere il passaggio consentito di movimento, luce e visuale. Le pareti strutturali SHALL restare distinte dai token e dai tracciati, che SHALL conservare i propri comportamenti. La memoria del terreno già esplorato SHALL essere conservata senza concedere visuale attuale sulle creature oltre le pareti.

#### Scenario: Parete composta

- **WHEN** il Master colloca cinque celle adiacenti
- **THEN** la board mostra una parete continua e un movimento Adventurer che la attraversa viene rifiutato integralmente dal server

#### Scenario: Apertura e luce

- **WHEN** una parete a celle presenta un'apertura percorribile e una fonte illumina dal lato opposto
- **THEN** l'apertura lascia passare luce e visuale secondo la geometria esistente, mentre le celle chiuse continuano a occludere

#### Scenario: Coesistenza con un tracciato

- **WHEN** una scena contiene pareti a celle e un tracciato diagonale
- **THEN** entrambi bloccano luce e visuale e soltanto le celle introducono il blocco strutturale del movimento

#### Scenario: Terreno ricordato oltre una nuova parete

- **WHEN** il Master aggiunge una parete a celle in una zona già esplorata
- **THEN** la memoria del terreno resta disponibile e la visione attuale delle creature rispetta la nuova barriera

### Requirement: Persistenza e isolamento delle pareti a celle

Le pareti strutturali SHALL essere salvate nella configurazione versionata della singola scena e ripristinate dopo reload o riavvio. Solo il Master autenticato SHALL poterle modificare. Un conflitto, dati invalidi o un errore di persistenza SHALL lasciare invariati documento, versione, runtime e memoria senza pubblicare un successo parziale. Una modifica accettata della scena attiva SHALL aggiornare la proiezione condivisa una sola volta; una scena inattiva SHALL restare privata. Scene e snapshot precedenti senza celle strutturali SHALL restare validi con una collezione vuota, preservando ostacoli-token e muri esistenti.

#### Scenario: Riapertura e compatibilità

- **WHEN** il server riapre una scena con celle salvate oppure una scena precedente alla funzionalità
- **THEN** recupera nel primo caso le celle confermate e nel secondo una collezione vuota senza conversioni automatiche degli ostacoli esistenti

#### Scenario: Autorizzazione e concorrenza

- **WHEN** una mutazione celle proviene da un client non autenticato, da un Adventurer o da una versione obsoleta
- **THEN** il server la rifiuta senza cambiare geometria o versione e restituisce il contesto di conflitto al Master autorizzato quando applicabile

#### Scenario: Fallimento della persistenza

- **WHEN** il salvataggio delle celle fallisce
- **THEN** documento, proiezione, memoria e versioni conservano il valore precedente e nessun aggiornamento viene trasmesso

#### Scenario: Preparazione privata e pubblicazione attiva

- **WHEN** il Master conferma una modifica a una scena inattiva e successivamente modifica la scena attiva
- **THEN** la prima operazione resta privata e soltanto la seconda produce un aggiornamento della proiezione condivisa della scena attiva

### Requirement: Preparazione delle luci puntuali per scena

Il Master SHALL poter aggiungere, spostare, rimuovere e modificare il raggio delle luci puntuali della scena selezionata nel passaggio Luci e visuale, tramite mappa e controlli da tastiera. Posizione e raggio SHALL rispettare le regole e i limiti esistenti delle luci. Ogni conferma SHALL salvare una configurazione versionata prima della proiezione; le modifiche a una scena inattiva SHALL restare private fino all'attivazione. Autorizzazione, conflitti e fallimenti SHALL preservare l'ultima configurazione confermata. Le modifiche alle luci SHALL NOT creare token o ampliare la memoria per effetto di una sola preview.

#### Scenario: Preparazione e riapertura

- **WHEN** il Master colloca una luce in una scena inattiva, ne salva il raggio e riapre la scena
- **THEN** ritrova posizione e raggio salvati senza aver modificato le luci della board corrente

#### Scenario: Anteprima e annullamento

- **WHEN** il Master modifica posizione o raggio di una luce in bozza e annulla
- **THEN** la configurazione confermata, la memoria e la vista degli altri partecipanti restano invariate

#### Scenario: Mutazione non ammessa

- **WHEN** una modifica luci non è autorizzata, contiene un raggio invalido, usa una versione obsoleta o fallisce la persistenza
- **THEN** nessuna configurazione parziale viene salvata o distribuita e il Master riceve il motivo del rifiuto quando autorizzato

#### Scenario: Luce della scena attiva

- **WHEN** il Master conferma lo spostamento di una luce della scena attiva
- **THEN** la luce salvata viene distribuita una sola volta e la visuale corrente rispetta entrambe le tipologie di parete
