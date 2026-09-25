## Purpose

Rendere il tiro d'iniziativa un'operazione autorevole del server, raggiungibile dalla scheda e dal tracker, con una modalità di tiro dichiarata in anticipo e un ordine dei turni deterministico anche in caso di parità.

## ADDED Requirements

### Requirement: Tiro d'iniziativa autorevole

Il tiro d'iniziativa SHALL essere eseguito dal server, che SHALL generare i dadi, applicare il modificatore, scrivere la voce nell'ordine di iniziativa e aggiungere una voce al log dei tiri nella stessa operazione. Il client SHALL trasmettere solo il token per cui tira e, dove previsto, la modalità; SHALL NOT trasmettere risultati, totali o modificatori. Il tiro SHALL essere accettato solo in modalità Combattimento, sia nella fase di tiro sia a round avviato; in Esplorazione il server SHALL rifiutarlo con un motivo comprensibile. Un token escluso dall'iniziativa, un token che non è una creatura o un token inesistente SHALL essere rifiutato.

#### Scenario: Tiro in Combattimento

- **WHEN** in modalità Combattimento un partecipante autorizzato tira l'iniziativa per un token
- **THEN** il token compare nell'ordine con il valore calcolato dal server e il log riporta il tiro con autore, dadi e totale

#### Scenario: Tiro in Esplorazione

- **WHEN** la sessione è in Esplorazione e arriva una richiesta di tiro d'iniziativa
- **THEN** il server la rifiuta con un motivo che cita la modalità Esplorazione, l'ordine non cambia e il log non riceve voci

#### Scenario: Valore dichiarato dal client

- **WHEN** una richiesta di tiro d'iniziativa contiene un valore o un totale
- **THEN** il server lo ignora e usa soltanto il risultato che ha generato

### Requirement: Autorizzazione del tiro per ruolo

L'Adventurer SHALL poter tirare l'iniziativa solo per il token del proprio personaggio e solo se quel token non ha già una voce nell'ordine; per ripetere o correggere un tiro serve il Master. Il Master SHALL poter tirare per qualunque creatura non esclusa, incluso il personaggio di un Adventurer che non ha tirato, e SHALL poter sostituire una voce esistente. Il Master SHALL disporre di un comando «Tira per tutti» che tira, nella stessa operazione, per ogni creatura non esclusa priva di voce, senza sovrascrivere le voci già presenti; nessun Adventurer SHALL poter usare questo comando.

#### Scenario: Tiro per un altro personaggio

- **WHEN** un Adventurer chiede di tirare l'iniziativa per un token che non è il suo personaggio
- **THEN** il server rifiuta la richiesta con errore di autorizzazione e l'ordine non cambia

#### Scenario: Secondo tiro dell'Adventurer

- **WHEN** un Adventurer che ha già una voce nell'ordine tira di nuovo l'iniziativa
- **THEN** il server rifiuta la richiesta e la voce esistente resta invariata

#### Scenario: Il Master tira per un Player assente

- **WHEN** il Master tira l'iniziativa per il personaggio di un Adventurer che non ha tirato
- **THEN** la voce del personaggio compare nell'ordine con la modalità salvata nella sua scheda

#### Scenario: Tira per tutti

- **WHEN** il Master usa «Tira per tutti» mentre un Adventurer ha già tirato
- **THEN** ogni altra creatura non esclusa riceve una voce e quella dell'Adventurer non cambia

### Requirement: Modalità del tiro d'iniziativa

Il tiro d'iniziativa di un token collegato a una scheda SHALL usare la modalità salvata in quella scheda — Normale, Vantaggio o Svantaggio — e il valore di iniziativa calcolato dalla scheda; nessuna modalità dichiarata dal client SHALL sostituirla. Il tiro di un token senza scheda SHALL usare il modificatore d'iniziativa del token e la modalità scelta dal Master per quel tiro, Normale per impostazione predefinita. Con Vantaggio il server SHALL tirare due `d20` e tenere il maggiore, con Svantaggio SHALL tenere il minore, con Normale SHALL tirare un solo `d20`. In ogni caso il risultato SHALL essere **un** valore. La voce di log SHALL mostrare entrambi i dadi quando sono due, indicando quale è stato tenuto, e la modalità usata.

#### Scenario: Vantaggio salvato nella scheda

- **WHEN** la scheda del personaggio ha modalità Vantaggio e il suo token tira l'iniziativa con dadi `7` e `15` e modificatore `+2`
- **THEN** la voce nell'ordine vale `17` e il log mostra entrambi i dadi, con il `15` indicato come tenuto

#### Scenario: Modalità dichiarata dall'Adventurer

- **WHEN** un Adventurer invia un tiro d'iniziativa dichiarando Vantaggio mentre la sua scheda è su Normale
- **THEN** il server ignora la modalità dichiarata e tira un solo `d20`

#### Scenario: Token senza scheda

- **WHEN** il Master tira per un token senza scheda scegliendo Svantaggio
- **THEN** il server tira due `d20`, tiene il minore e somma il modificatore d'iniziativa del token

### Requirement: Visibilità del tiro d'iniziativa nel log

Il tiro d'iniziativa del personaggio di un Adventurer SHALL essere pubblico. Il tiro per una creatura che non è il personaggio di un Adventurer SHALL essere segreto, visibile solo al Master, così che il log non riveli creature che un Adventurer non può vedere. La voce nell'ordine di iniziativa SHALL restare soggetta alle regole di visibilità dei token già in vigore.

#### Scenario: Tiro per un mostro

- **WHEN** il Master tira l'iniziativa per un token nemico
- **THEN** il log del Master riporta il tiro e il log di ogni Adventurer non lo riceve

### Requirement: Ordinamento e spareggio

L'ordine d'iniziativa SHALL essere dal valore più alto al più basso. A parità di valore SHALL venire prima la voce con il modificatore di Destrezza più alto: per un token collegato a una scheda è quello calcolato dal punteggio di Destrezza, per un token senza scheda è il suo modificatore d'iniziativa. A parità anche di Destrezza SHALL decidere una frazione casuale che il server genera quando crea la voce, tirata o manuale. La frazione SHALL NOT essere mostrata in alcuna interfaccia e SHALL NOT essere trasmessa agli Adventurer. Una volta creata, la frazione di una voce SHALL restare stabile finché la voce non viene sostituita, così che l'ordine non cambi fra un aggiornamento e l'altro.

#### Scenario: Parità risolta dalla Destrezza

- **WHEN** due voci valgono `15` e i due personaggi hanno modificatore di Destrezza `+3` e `+1`
- **THEN** la voce con `+3` viene prima

#### Scenario: Parità completa

- **WHEN** due voci hanno lo stesso valore e lo stesso modificatore di Destrezza
- **THEN** l'ordine è deciso dalla frazione nascosta, resta identico per tutti i client e non cambia agli aggiornamenti successivi

#### Scenario: Frazione non esposta

- **WHEN** un Adventurer riceve lo stato via HTTP o SSE
- **THEN** le voci d'iniziativa non contengono la frazione di spareggio

### Requirement: Ordine imposto dal Master

Il Master SHALL poter spostare una voce in qualunque posizione, indipendentemente dal suo valore, e SHALL poter inserire una voce con un valore manuale o con un tiro. Una posizione imposta dal Master SHALL prevalere sulle regole di ordinamento e SHALL essere conservata finché il Master non la cambia. Una voce nuova SHALL essere inserita davanti alla prima voce esistente che la segue secondo le regole di ordinamento, senza riordinare le altre. Il Master SHALL poter rimuovere una voce. Nessun Adventurer SHALL poter spostare, inserire manualmente o rimuovere voci.

#### Scenario: Spostamento contro il valore

- **WHEN** il Master sposta una voce da `8` sopra una voce da `18`
- **THEN** l'ordine resta quello scelto dal Master anche dopo un nuovo aggiornamento dello stato

#### Scenario: Inserimento dopo uno spostamento

- **WHEN** dopo uno spostamento del Master un Adventurer tira `12`
- **THEN** la sua voce compare davanti alla prima voce esistente che la segue per valore e Destrezza, e le altre voci mantengono la posizione relativa

#### Scenario: Spostamento da parte di un Adventurer

- **WHEN** un Adventurer invia una richiesta di riordino
- **THEN** il server la rifiuta con errore di autorizzazione e l'ordine non cambia

### Requirement: Compatibilità e concorrenza del tracker

Uno snapshot salvato prima di questa capability SHALL caricarsi senza errori: le voci esistenti SHALL conservare posizione e valore e ricevere una frazione di spareggio. Due richieste di tiro concorrenti per lo stesso token SHALL produrre al più una voce; per un Adventurer la seconda SHALL essere rifiutata come secondo tiro. Una mutazione del tracker rifiutata SHALL lasciare invariati ordine, turno e log, e il client SHALL riallineare ogni aggiornamento ottimistico allo stato del server.

#### Scenario: Snapshot con voci esistenti

- **WHEN** viene ripreso uno snapshot che contiene un ordine di iniziativa senza frazioni di spareggio
- **THEN** l'ordine si carica nella stessa sequenza e ogni voce riceve una frazione

#### Scenario: Doppio click sul tiro

- **WHEN** un Adventurer invia due tiri d'iniziativa per il proprio token quasi nello stesso momento
- **THEN** nell'ordine compare una sola voce, nel log un solo tiro, e la seconda richiesta viene rifiutata
