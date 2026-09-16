## Purpose

Definire la scheda personale 5e della campagna locale, la sua organizzazione in tre tab, i permessi di accesso, il ritratto modificabile e i valori condivisi con il token sulla mappa.

## ADDED Requirements

### Requirement: Una scheda attiva per Adventurer e campagna

Il sistema SHALL mantenere una sola scheda attiva per ogni utente con ruolo `adventurer` nella campagna locale. L'inizializzazione SHALL essere idempotente e SHALL creare una scheda vuota completa quando non ne esiste già una per la coppia utente-campagna.

#### Scenario: Prima inizializzazione della campagna

- **WHEN** il server inizializza la campagna locale e un Adventurer non possiede ancora una scheda
- **THEN** il sistema crea una scheda con tutte le sezioni previste e versione iniziale valida

#### Scenario: Riavvio con scheda esistente

- **WHEN** il server inizializza nuovamente una campagna che contiene già la scheda dell'Adventurer
- **THEN** il sistema riutilizza la scheda esistente senza crearne un duplicato né perdere i dati

### Requirement: Accesso alla scheda secondo il ruolo

Un Adventurer SHALL poter leggere e modificare la propria scheda completa. Il Master SHALL poter leggere e modificare tutte le schede della campagna. Un Adventurer diverso dal proprietario SHALL ricevere soltanto i dati pubblici già previsti dal roster e SHALL NOT poter leggere, modificare o sottoscrivere il contenuto della scheda altrui.

#### Scenario: Il proprietario apre la propria scheda

- **WHEN** un Adventurer autenticato richiede la propria scheda
- **THEN** il sistema restituisce l'intero contenuto modificabile della scheda

#### Scenario: Il Master apre la scheda di un Player

- **WHEN** il Master autenticato richiede la scheda di un Adventurer della campagna
- **THEN** il sistema restituisce l'intero contenuto modificabile della scheda

#### Scenario: Un Player richiede la scheda altrui

- **WHEN** un Adventurer autenticato richiede la scheda di un altro Adventurer
- **THEN** il sistema nega l'accesso senza esporre dati privati della scheda

### Requirement: Finestra della scheda a tre tab

La scheda SHALL aprirsi dalla tab Personaggi in una finestra flottante e compatta, con proporzioni coerenti con la finestra personaggio di Roll20, larghezza contenuta e sviluppo interno prevalentemente verticale, senza sostituire o reimpostare la mappa. Su viewport desktop SHALL poter essere trascinata dalla testata, SHALL restare confinata nell'area visibile e SHALL lasciare utilizzabile il workspace circostante. SHALL offrire le tab `Personaggio e combattimento`, `Aspetto e storia` e `Incantesimi`, SHALL conservare le modifiche passando da una tab all'altra e SHALL ripristinare il contesto e il focus della sessione alla chiusura. Su viewport stretti SHALL adattarsi a tutto schermo senza richiedere il trascinamento.

#### Scenario: Apertura e navigazione della scheda

- **WHEN** un utente autorizzato apre una scheda e passa tra le tre tab
- **THEN** ogni tab mostra la propria area e i valori modificati restano disponibili durante la navigazione

#### Scenario: Chiusura della scheda

- **WHEN** l'utente chiude la finestra della scheda con il comando di chiusura o con Escape
- **THEN** torna alla sessione e alla mappa nello stato visuale precedente

#### Scenario: Spostamento della finestra nel workspace

- **WHEN** l'utente trascina la testata della scheda su un viewport desktop
- **THEN** la finestra segue il puntatore, resta interamente raggiungibile entro il viewport e mantiene visibile e utilizzabile il workspace non coperto

#### Scenario: Spostamento accessibile da tastiera

- **WHEN** la testata ha il focus e l'utente usa Alt più i tasti freccia
- **THEN** la finestra si sposta a incrementi prevedibili entro il viewport senza modificare i dati della scheda

#### Scenario: Riapertura della finestra

- **WHEN** l'utente chiude e riapre la scheda sullo stesso dispositivo desktop
- **THEN** la finestra riutilizza l'ultima posizione valida oppure la riporta entro il viewport se le dimensioni disponibili sono cambiate

### Requirement: Resa grafica coerente con il PDF 5e

La scheda SHALL tradurre nel web la gerarchia grafica delle tre pagine di `5E_CharacterSheet_Fillable.pdf`. SHALL usare una superficie chiara ad alto contrasto, cornici scure ornamentali, pannelli e separatori grigio chiaro, etichette compatte, valori principali in riquadri sagomati e una composizione a colonne riconoscibile. SHALL preservare raggruppamento, peso visivo e ordine di lettura della pagina PDF corrispondente in ciascuna tab, adattandoli in modo responsive senza usare il logo o le illustrazioni del documento originale.

#### Scenario: Confronto della tab Personaggio e combattimento

- **WHEN** la tab `Personaggio e combattimento` viene confrontata con la prima pagina del PDF su un viewport desktop
- **THEN** l'intestazione occupa l'intera larghezza con il nome in evidenza allineato al riquadro dei dati di classe, e sotto di essa tre colonne di uguale larghezza raccolgono nell'ordine caratteristiche e competenze, blocco di combattimento con attacchi ed equipaggiamento, e tratti con risorse e privilegi

#### Scenario: Confronto della tab Aspetto e storia

- **WHEN** la tab `Aspetto e storia` viene confrontata con la seconda pagina del PDF su un viewport desktop
- **THEN** dati fisici, ritratto o aspetto, alleati, storia, privilegi aggiuntivi e tesori mantengono la composizione per grandi pannelli della pagina di riferimento

#### Scenario: Confronto della tab Incantesimi

- **WHEN** la tab `Incantesimi` viene confrontata con la terza pagina del PDF su un viewport desktop
- **THEN** intestazione da incantatore e livelli 0-9 mantengono una scansione densa a colonne con livello e slot evidenziati

#### Scenario: Adattamento a un viewport stretto

- **WHEN** la larghezza non consente la composizione desktop a più colonne
- **THEN** i gruppi si dispongono in un ordine verticale coerente con il PDF, restano leggibili e utilizzabili e non richiedono scorrimento orizzontale della finestra

### Requirement: Dati di personaggio e combattimento

La tab `Personaggio e combattimento` SHALL rendere manualmente modificabili: nome; classe; sottoclasse; livello; razza; background; allineamento; punti esperienza; ispirazione; bonus di competenza; sei caratteristiche e relativi modificatori; tiri salvezza con competenza e valore; abilità con competenza e valore; Percezione passiva; Classe Armatura; iniziativa; velocità; punti ferita massimi, attuali e temporanei; tipo, totale e rimanenti dei dadi vita; successi e fallimenti dei tiri salvezza contro morte; tratti della personalità; ideali; legami; difetti; monete CP, SP, GP e PP; peso totale dell'equipaggiamento. SHALL gestire come collezioni ripetibili: attacchi con nome, bonus, danno o tipo e note; oggetti di equipaggiamento con quantità, nome e peso; strumenti e competenze con nome, tipo di competenza fra `Proficient`, `Expertise` e `None`, attributo fra le sei caratteristiche o nessuno e modificatore; linguaggi con il solo nome; privilegi e tratti con nome, fonte fra `Razziale`, `Classe`, `Talento`, `Background`, `Oggetto` e `Altro` e descrizione; sezioni di risorse, ciascuna composta dai due blocchi fissi `Risorsa di classe` e `Altra risorsa` con nome, totale e attuale. SHALL NOT offrire una sezione Azioni né la moneta Electrum.

#### Scenario: Modifica dei valori di combattimento

- **WHEN** il proprietario o il Master modifica punti ferita, iniziativa, una competenza o una caratteristica
- **THEN** il sistema conserva esattamente i valori inseriti senza ricalcolarli automaticamente

#### Scenario: Aggiunta di elementi oltre le righe iniziali

- **WHEN** un utente autorizzato aggiunge attacchi, oggetti, strumenti, linguaggi, privilegi o sezioni di risorse
- **THEN** la scheda crea ulteriori elementi modificabili singolarmente e rimovibili, senza un limite derivato dal layout del PDF

#### Scenario: Filtro dei privilegi e tratti

- **WHEN** l'utente digita un testo nel filtro dei privilegi e tratti
- **THEN** l'elenco mostra soltanto i privilegi il cui nome o descrizione contiene quel testo, senza modificare i dati della scheda

#### Scenario: Documento salvato prima della riorganizzazione

- **WHEN** viene caricata una scheda che contiene equipaggiamento, competenze e linguaggi o privilegi come testo unico, azioni oppure monete Electrum
- **THEN** il sistema converte i testi riconosciuti nella prima riga della collezione corrispondente e scarta i campi non più previsti senza rifiutare il documento

### Requirement: Dati di aspetto e storia

La tab `Aspetto e storia` SHALL rendere manualmente modificabili: nome; età; altezza; peso; occhi; pelle; capelli; aspetto; alleati e organizzazioni; nome testuale della fazione; storia; privilegi aggiuntivi; tesori. La tab SHALL NOT offrire l'upload di un'immagine della fazione.

#### Scenario: Compilazione della storia

- **WHEN** un utente autorizzato compila aspetto, storia, alleati, fazione o tesori
- **THEN** i testi inseriti restano associati alla scheda e sono disponibili alle successive aperture

#### Scenario: Fazione senza allegato

- **WHEN** l'utente compila il nome della fazione
- **THEN** il sistema accetta il testo senza richiedere né offrire un'immagine della fazione

### Requirement: Dati degli incantesimi

La tab `Incantesimi` SHALL rendere manualmente modificabili classe da incantatore, caratteristica da incantatore, CD del tiro salvezza e bonus di attacco. SHALL gestire trucchetti e incantesimi di livello 1-9 come elementi ripetibili, con stato preparato o conosciuto, e SHALL gestire slot totali e rimanenti per ciascun livello applicabile.

#### Scenario: Compilazione degli incantesimi

- **WHEN** un utente autorizzato aggiunge incantesimi, cambia il loro stato o aggiorna gli slot
- **THEN** la tab conserva i valori manuali per ciascun livello senza applicare regole automatiche di classe o livello

#### Scenario: Aggiunta oltre le righe del PDF

- **WHEN** un livello contiene più incantesimi delle righe presenti nel PDF di riferimento
- **THEN** l'utente può aggiungere ulteriori elementi ripetibili nella stessa sezione

### Requirement: Compilazione manuale senza importazioni

Tutti i valori della scheda SHALL essere compilabili manualmente per supportare regole personalizzate. P0.4 SHALL NOT importare PDF, JSON, schede di altri VTT o allegati generici e SHALL NOT automatizzare avanzamento di livello, calcoli delle regole o tiri di dado dalla scheda.

#### Scenario: Inserimento di un valore homebrew

- **WHEN** un utente autorizzato inserisce un valore o un testo non derivabile dalle regole standard
- **THEN** il sistema lo accetta e lo conserva come inserito

#### Scenario: Tentativo di importazione

- **WHEN** un utente cerca un comando per importare una scheda o un allegato generico
- **THEN** l'interfaccia non presenta tale funzione e le API della scheda non accettano quel contenuto come importazione

### Requirement: Ritratto personale sostituibile

Il proprietario e il Master SHALL poter sostituire il ritratto del personaggio con un file JPEG, PNG o WebP di massimo 5 MB. Il server SHALL verificare dimensione e tipo effettivo, SHALL usare un nome generato in una directory gestita e SHALL sostituire il file precedente senza lasciare il record in uno stato incoerente. Il ritratto aggiornato SHALL apparire nella scheda e nel roster, ma SHALL NOT cambiare automaticamente l'immagine del token.

#### Scenario: Upload valido del ritratto

- **WHEN** un utente autorizzato carica un JPEG, PNG o WebP valido entro 5 MB
- **THEN** il sistema salva il nuovo ritratto con un nome gestito e lo mostra nella scheda e nel roster

#### Scenario: File non valido

- **WHEN** l'utente carica un file oltre 5 MB, con tipo non ammesso o con contenuto incompatibile con il tipo dichiarato
- **THEN** il sistema rifiuta il file e mantiene disponibile il ritratto precedente

#### Scenario: Ritratto e token restano distinti

- **WHEN** il ritratto della scheda viene sostituito
- **THEN** l'immagine del token sulla mappa non cambia

### Requirement: Collegamento esplicito tra scheda e token

Le modifiche accettate a nome, punti ferita massimi, attuali e temporanei, velocità e modificatore di iniziativa SHALL aggiornare i valori corrispondenti del token associato. Il ritratto e la Classe Armatura SHALL restare dati della scheda in P0.4 e SHALL NOT essere copiati automaticamente sul token.

#### Scenario: Aggiornamento di un valore condiviso

- **WHEN** un utente autorizzato modifica nella scheda un valore collegato al token
- **THEN** il token associato riceve il nuovo valore senza richiedere un aggiornamento della pagina

#### Scenario: Aggiornamento di un valore non condiviso

- **WHEN** un utente modifica il ritratto o la Classe Armatura
- **THEN** il token non viene modificato da quel cambiamento
