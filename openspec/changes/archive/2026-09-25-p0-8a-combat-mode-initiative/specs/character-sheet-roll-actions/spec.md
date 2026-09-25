## MODIFIED Requirements

### Requirement: Tiro doppio indipendente per ogni bersaglio 1d20

Ogni bersaglio la cui formula è `1d20 +` un modificatore — caratteristica, tiro salvezza, abilità, strumento, tiro di attacco — SHALL generare due tiri di `1d20` indipendenti nella stessa richiesta, nessuno dei due scelto o scartato dal server. Il client SHALL NOT dichiarare vantaggio o svantaggio prima del tiro: la scelta di quale dei due risultati contare (il primo per un tiro normale, il maggiore per vantaggio, il minore per svantaggio) resta della persona che legge il log. L'iniziativa SHALL fare eccezione: il suo valore deve guidare l'ordine dei turni, quindi il server SHALL risolverla in un valore solo con la modalità salvata nella scheda, secondo la capability `initiative-rolling`. Il dado vita e il salvataggio contro morte SHALL restare un tiro singolo: il primo non è un `1d20`, il secondo non ha nozione di vantaggio o svantaggio nelle regole 5e.

#### Scenario: Bersaglio 1d20 tirato due volte

- **WHEN** un utente autorizzato clicca un bersaglio la cui formula è `1d20` più un modificatore, diverso dall'iniziativa
- **THEN** il log riporta due valori naturali indipendenti con lo stesso modificatore applicato a entrambi, senza indicare quale dei due sia stato scelto

#### Scenario: L'iniziativa produce un valore solo

- **WHEN** un utente autorizzato clicca il bersaglio Iniziativa con la scheda in modalità Normale
- **THEN** il log riporta un solo `1d20` e un solo totale, che è anche il valore della voce nell'ordine di iniziativa

#### Scenario: Il dado vita resta singolo

- **WHEN** un utente autorizzato tira il riquadro dei dadi vita
- **THEN** il log riporta un solo dado, del tipo scelto nel riquadro

#### Scenario: Il salvataggio contro morte resta singolo

- **WHEN** un utente autorizzato tira il riquadro dei salvataggi contro morte
- **THEN** il log riporta un solo `1d20`, senza un secondo tiro indipendente

### Requirement: Tiri della scheda equi con disposizione coerente col dominio

Ogni dado generato da un'azione della scheda SHALL passare dallo stesso motore autorevole equo dei tiri liberi e SHALL comparire nel dettaglio per-dado della voce di log. I dadi che contribuiscono senza ambiguità al risultato SHALL essere `kept`; i due d20 indipendenti di un bersaglio `1d20` per cui la scelta resta alla persona SHALL essere entrambi `unresolved`. Nel tiro d'iniziativa con Vantaggio o Svantaggio il `d20` tenuto dal server SHALL essere `kept` e l'altro `discarded`; la presentazione SHALL continuare a rendere entrambi con pari enfasi. Dadi appartenenti a blocchi di danno diversi SHALL avere gruppi distinti. I campi aggregati e le parti esistenti SHALL restare disponibili e coerenti con il dettaglio per-dado.

#### Scenario: Bersaglio 1d20 con scelta rinviata

- **WHEN** un utente autorizzato tira una prova di abilità dalla scheda
- **THEN** il log contiene due d20 distinti entrambi `unresolved`, mentre `rolls`, `keptRolls` e `total` mantengono la compatibilità già definita per il primo tiro

#### Scenario: Iniziativa con Vantaggio

- **WHEN** un utente autorizzato tira l'iniziativa dalla scheda in modalità Vantaggio
- **THEN** il log contiene due d20, il maggiore `kept` e l'altro `discarded`, e `total` corrisponde al dado tenuto più il modificatore

#### Scenario: Danno con due blocchi

- **WHEN** un utente autorizzato tira un attacco con due blocchi di danno attivi
- **THEN** tutti i dadi sono `kept`, i dadi di ciascun blocco condividono il proprio `groupId` e i due blocchi hanno `groupId` diversi

#### Scenario: Dadi raddoppiati dal critico

- **WHEN** il server applica il critico a un tiro di danno
- **THEN** il dettaglio contiene anche ciascun dado aggiuntivo generato dal raddoppio e totale, parti e campi aggregati restano coerenti

#### Scenario: Effetto collaterale del tiro

- **WHEN** un dado vita o un salvataggio contro morte viene accettato
- **THEN** il valore usato per l'effetto collaterale proviene dal medesimo risultato per-dado autorevole registrato nel log

## ADDED Requirements

### Requirement: Iniziativa dalla scheda collegata al tracker

Il tiro del bersaglio Iniziativa SHALL essere lo stesso tiro d'iniziativa autorevole della capability `initiative-rolling`: SHALL scrivere la voce del token collegato alla scheda nell'ordine di iniziativa e SHALL seguirne autorizzazioni, modalità, visibilità e rifiuti. In Esplorazione il bersaglio SHALL apparire disabilitato con una spiegazione, e un tiro inviato comunque SHALL essere rifiutato senza voce di log. Una scheda senza token collegato sulla mappa SHALL ricevere un rifiuto comprensibile. L'interruttore di visibilità segreta della scheda SHALL NOT applicarsi all'iniziativa, la cui visibilità è definita da `initiative-rolling`.

#### Scenario: Tiro dalla scheda in Combattimento

- **WHEN** un Adventurer in modalità Combattimento clicca Iniziativa sulla propria scheda
- **THEN** la voce del suo personaggio compare nel tracker e il log riporta il tiro con il nome del personaggio e l'azione «Iniziativa»

#### Scenario: Tiro dalla scheda in Esplorazione

- **WHEN** la sessione è in Esplorazione
- **THEN** il bersaglio Iniziativa è disabilitato e spiega che il tiro si abilita all'avvio del combattimento

#### Scenario: Interruttore segreto attivo

- **WHEN** un Adventurer con l'interruttore segreto attivo tira l'iniziativa dalla propria scheda
- **THEN** il tiro è pubblico, come ogni tiro d'iniziativa del personaggio di un Adventurer
