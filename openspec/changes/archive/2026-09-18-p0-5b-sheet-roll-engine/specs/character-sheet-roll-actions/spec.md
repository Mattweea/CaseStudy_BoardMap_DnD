## Purpose

Collegare i bersagli cliccabili della scheda del personaggio al motore dei tiri autorevole del server, così che un tiro tipico costi un solo click e resti ricostruito e verificato lato server invece che affidato al client.

## ADDED Requirements

### Requirement: Bersagli di tiro e modello di interazione

Ogni elemento anticipato come bersaglio dalla Fase A di P0.5 — le sei caratteristiche, i sei tiri salvezza, le diciotto abilità, l'iniziativa, ogni riga di strumento, il tiro di attacco e il danno di ogni riga di attacco (due bersagli distinti sulla stessa riga), il riquadro dei dadi vita e il riquadro dei salvataggi contro morte — SHALL essere un bersaglio di click esplicito. Il click SHALL eseguire subito il tiro, con visibilità pubblica di default; nessuna modale di configurazione precede il tiro. Nessun altro elemento della scheda, inclusi la Percezione passiva e le righe della tab Incantesimi, SHALL produrre un tiro. Modificare un campo della scheda SHALL NOT poter avviare un tiro, e un tiro SHALL NOT poter modificare un campo al di fuori degli effetti collaterali esplicitamente previsti da questa capability.

#### Scenario: Click su un bersaglio valido

- **WHEN** un utente autorizzato clicca il bersaglio di un'abilità, di un tiro salvezza, di una caratteristica, dell'iniziativa, di uno strumento, del tiro di attacco o del danno di un attacco
- **THEN** il tiro parte subito con la formula prevista per quel bersaglio, senza alcuna scelta preliminare

#### Scenario: Bersagli esclusi

- **WHEN** un utente clicca il riquadro della Percezione passiva o una riga della tab Incantesimi
- **THEN** nessun tiro parte e nessuna voce viene aggiunta al log

### Requirement: Tiro doppio indipendente per ogni bersaglio 1d20

Ogni bersaglio la cui formula è `1d20 +` un modificatore — caratteristica, tiro salvezza, abilità, iniziativa, strumento, tiro di attacco — SHALL generare due tiri di `1d20` indipendenti nella stessa richiesta, nessuno dei due scelto o scartato dal server. Il client SHALL NOT dichiarare vantaggio o svantaggio prima del tiro: la scelta di quale dei due risultati contare (il primo per un tiro normale, il maggiore per vantaggio, il minore per svantaggio) resta della persona che legge il log. Il dado vita e il salvataggio contro morte SHALL restare un tiro singolo: il primo non è un `1d20`, il secondo non ha nozione di vantaggio o svantaggio nelle regole 5e.

#### Scenario: Bersaglio 1d20 tirato due volte

- **WHEN** un utente autorizzato clicca un bersaglio la cui formula è `1d20` più un modificatore
- **THEN** il log riporta due valori naturali indipendenti con lo stesso modificatore applicato a entrambi, senza indicare quale dei due sia stato scelto

#### Scenario: Il dado vita resta singolo

- **WHEN** un utente autorizzato tira il riquadro dei dadi vita
- **THEN** il log riporta un solo dado, del tipo scelto nel riquadro

#### Scenario: Il salvataggio contro morte resta singolo

- **WHEN** un utente autorizzato tira il riquadro dei salvataggi contro morte
- **THEN** il log riporta un solo `1d20`, senza un secondo tiro indipendente

### Requirement: Ricostruzione server-side della formula dai campi della scheda

Il server SHALL ricostruire la formula del tiro dai campi correnti della scheda al momento della richiesta, e SHALL ignorare qualunque formula, risultato o modificatore proposto dal client per quel bersaglio. Le formule SHALL essere:

- caratteristica: `1d20 +` il modificatore calcolato dal punteggio;
- tiro salvezza: `1d20 +` il valore calcolato della riga;
- abilità: `1d20 +` il valore calcolato della riga;
- iniziativa: `1d20 +` il valore calcolato del riquadro;
- strumento: `1d20 +` il bonus calcolato della riga;
- tiro di attacco: `1d20 +` il bonus di attacco calcolato dell'attacco;
- danno di un attacco: la formula del dado del primo blocco di danno (sempre attivo) `+` il suo modificatore, più la formula e il modificatore del secondo blocco quando attivo, senza alcun tiro di attacco associato;
- dado vita: il dado del tipo scelto nel riquadro, senza modificatori;
- tiro salvezza contro morte: `1d20` senza modificatori.

Il tiro di attacco e il danno del medesimo attacco SHALL essere bersagli distinti, ciascuno con la propria voce di log: cliccare il tiro di attacco SHALL NOT generare alcun dado di danno, e cliccare il danno SHALL NOT generare alcun tiro di attacco. Quando il blocco del tiro salvezza dell'attacco è attivo, il server SHALL riportare sul tiro di attacco la caratteristica e la CD dichiarate, senza generare un tiro aggiuntivo per quella CD. Il server SHALL riusare il generatore già usato dal tiro libero di P0.3 per ciascun dado generato da questa capability.

#### Scenario: Formula di un'abilità

- **WHEN** un utente autorizzato tira Furtività con Destrezza `16` e competenza esperta a livello `5`
- **THEN** il server tira due `1d20` e somma a ciascuno il valore calcolato della riga Furtività, senza accettare alcuna formula inviata dal client

#### Scenario: Danno con entrambi i blocchi e un tiro salvezza dichiarato

- **WHEN** un utente autorizzato tira il danno di un attacco con due blocchi di danno attivi e un blocco di tiro salvezza attivo
- **THEN** il log del danno riporta il risultato di entrambi i blocchi; la caratteristica e la CD del tiro salvezza compaiono sulla voce di log del tiro di attacco, non su quella del danno

#### Scenario: Dado vita con tipo scelto

- **WHEN** un utente autorizzato tira un dado vita di tipo `d8`
- **THEN** il server tira `1d8` senza modificatori

### Requirement: Rifiuto dei bersagli non calcolabili e non autorizzati

Il server SHALL rifiutare con un errore leggibile, senza aggiungere alcuna voce al log, il tiro di un bersaglio il cui valore non è interpretabile come numero secondo le regole della Fase A, un tiro su un dado vita senza tipo scelto o senza dadi rimanenti, il danno di un attacco senza alcun blocco di danno attivo, e un tiro richiesto da un utente che non può leggere quella scheda secondo i permessi già definiti da P0.4.

#### Scenario: Valore non calcolabile

- **WHEN** un utente autorizzato tira un bersaglio il cui valore mostra un segnaposto neutro perché un input a monte non è interpretabile
- **THEN** il server rifiuta il tiro con un errore comprensibile e nessuna voce compare nel log

#### Scenario: Dado vita esaurito o non scelto

- **WHEN** un utente autorizzato tenta di tirare il riquadro dei dadi vita senza dadi rimanenti o senza un tipo scelto
- **THEN** il server rifiuta il tiro e l'interfaccia ne spiega il motivo senza aggiungere una voce al log

#### Scenario: Richiedente senza permesso di lettura

- **WHEN** un Adventurer che non è né proprietario né Master richiede un tiro su una scheda altrui
- **THEN** il server rifiuta la richiesta e non genera alcun tiro

### Requirement: Critico dedotto dal tiro di attacco più recente, applicato al danno

Il tiro di attacco SHALL dichiarare nel proprio log un esito critico quando almeno uno dei due `1d20` naturali raggiunge la soglia di critico dell'attacco. Un tiro del danno dello stesso attacco SHALL accettare dal client la dichiarazione di applicare il critico; quando applicato, il server SHALL raddoppiare i dadi di ciascun blocco di danno attivo lasciando invariati i modificatori, e SHALL dichiararlo nella propria voce di log. Il client SHALL dedurre se dichiarare il critico dall'esito del tiro di attacco più recente per lo stesso bersaglio, senza che l'utente lo scelga a mano.

#### Scenario: Tiro di attacco naturale sopra la soglia

- **WHEN** almeno uno dei due `1d20` del tiro di attacco esce pari o superiore alla soglia di critico
- **THEN** il log del tiro di attacco dichiara il critico

#### Scenario: Danno tirato dopo un attacco critico

- **WHEN** un utente autorizzato tira il danno dello stesso attacco subito dopo un tiro di attacco dichiarato critico
- **THEN** i dadi di ciascun blocco di danno attivo sono raddoppiati, il modificatore di danno resta invariato e il log del danno dichiara il critico

#### Scenario: Danno tirato dopo un attacco non critico

- **WHEN** nessuno dei due `1d20` del tiro di attacco più recente per quel bersaglio raggiunge la soglia di critico
- **THEN** il danno usa i dadi dichiarati senza raddoppio

### Requirement: Effetti collaterali applicati come patch della scheda

Un tiro dal riquadro dei dadi vita, se accettato, SHALL far calare di uno i dadi vita rimanenti; un tiro dai salvataggi contro morte SHALL riempire un pallino di fallimento per un risultato da 1 a 9 o un pallino di successo per un risultato da 10 a 20 sul primo dei due `1d20`, fino al terzo pallino di ciascun tipo. Questi SHALL essere gli unici effetti collaterali che un tiro può scrivere sulla scheda, SHALL essere applicati come patch validate secondo lo stesso schema, controllo di versione, distribuzione SSE e persistenza con debounce già usati da P0.4, e SHALL essere respinti dal server come qualunque altra patch quando il documento risultante non è valido.

#### Scenario: Dado vita lanciato

- **WHEN** un tiro sul riquadro dei dadi vita viene accettato
- **THEN** i dadi vita rimanenti calano di uno su tutti i client autorizzati, senza ricaricare la pagina

#### Scenario: Fallimento contro la morte

- **WHEN** il primo dei due `1d20` di un tiro sui salvataggi contro morte produce un risultato da 1 a 9
- **THEN** un pallino di fallimento si riempie e il contatore resta fra 0 e 3

#### Scenario: Terzo esito raggiunto

- **WHEN** il terzo pallino di successo o di fallimento contro morte si riempie
- **THEN** l'esito è segnalato e ulteriori tiri sui salvataggi contro morte di quella scheda sono respinti finché i pallini non vengono azzerati a mano

### Requirement: Log collegato al personaggio e all'azione, tracciabile fino al bersaglio d'origine

Ogni voce di log generata da questa capability SHALL riportare il personaggio e l'azione che hanno originato il tiro, cosicché il log distingua un'abilità, un tiro salvezza, uno strumento, un tiro di attacco o un danno l'uno dall'altro, con lo stesso formato e le stesse regole di visibilità pubblica/segreta già usate dal tiro libero di P0.3. Ogni voce SHALL riportare anche il riferimento alla scheda e al bersaglio d'origine, così che il danno di un attacco possa essere tirato di nuovo a partire dalla sua voce di log.

#### Scenario: Distinzione fra bersagli nello stesso log

- **WHEN** un partecipante consulta il log dopo aver tirato una prova di Furtività e un attacco dalla stessa scheda
- **THEN** le due voci sono distinguibili per personaggio e azione, per esempio «Prova di Furtività» e «Attacco — Spada corta»

#### Scenario: Danno tirato di nuovo dal log

- **WHEN** un utente autorizzato interagisce con la voce di log di un tiro di attacco per tirarne il danno
- **THEN** il server tira il danno di quello stesso attacco, applicando il critico se quel tiro di attacco lo aveva dichiarato

#### Scenario: Visibilità riusata dal tiro libero

- **WHEN** un utente autorizzato esegue un tiro segreto da un bersaglio della scheda
- **THEN** soltanto l'autore e il Master lo vedono nel log, con le stesse regole di visibilità del tiro libero di P0.3
