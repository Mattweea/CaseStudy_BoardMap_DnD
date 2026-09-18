# character-sheet-management Specification

## Purpose

Definire la scheda personale 5e della campagna locale, la sua organizzazione in tre tab, i permessi di accesso, il ritratto modificabile e i valori condivisi con il token sulla mappa.

## Requirements

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

### Requirement: Resa grafica derivata dal PDF 5e in direzione Grimorio di brace

La scheda SHALL tradurre nel web la gerarchia grafica delle tre pagine di `5E_CharacterSheet_Fillable.pdf`, preservando raggruppamento, peso visivo e ordine di lettura della pagina corrispondente in ciascuna tab e adattandoli in modo responsive. SHALL usare la direzione visiva "Grimorio di brace": superficie scura coerente con la sessione, testo avorio con contrasto almeno WCAG AA, valori principali in riquadri con angoli smussati che non tagliano l'indicatore di focus, etichette di almeno circa 11px e accento brace riservato a elementi interattivi e stato di salvataggio. SHALL NOT usare il logo o le illustrazioni del documento originale.

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

#### Scenario: Gerarchia dei valori in gioco

- **WHEN** la tab `Personaggio e combattimento` è visibile
- **THEN** il modificatore di ogni caratteristica è il numero primario e il punteggio è secondario
- **AND** i punti ferita mostrano una barra non interattiva derivata da attuali e massimi, con tono che cambia sotto soglia e i temporanei come strato separato; con valori non numerici la barra non compare e nessun dato viene scritto

#### Scenario: Focus e movimento

- **WHEN** l'utente naviga la scheda da tastiera
- **THEN** ogni controllo mostra un indicatore di focus integro e non tagliato
- **AND** i pulsanti di rimozione delle righe diventano visibili al passaggio del puntatore o con il focus nella riga
- **AND** le transizioni tra tab e gli indicatori animati rispettano `prefers-reduced-motion`

### Requirement: Dati di personaggio e combattimento

La tab `Personaggio e combattimento` SHALL rendere manualmente modificabili: nome; classe; sottoclasse; livello come intero; razza; background; allineamento; punti esperienza; ispirazione; punteggio delle sei caratteristiche come intero; competenza dei tiri salvezza e relativo bonus vari; livello di competenza delle abilità e relativo bonus vari; bonus vari dell'iniziativa; Classe Armatura; velocità; punti ferita massimi, attuali e temporanei; totale dei dadi vita, dadi vita rimanenti e tipo di dado vita scelto fra lo stato «non scelto» e `d4`, `d6`, `d8`, `d10`, `d12`; successi e fallimenti dei tiri salvezza contro morte come contatori da 0 a 3; tratti della personalità; ideali; legami; difetti; monete CP, SP, GP e PP; peso totale dell'equipaggiamento. SHALL mostrare come valori di sola lettura, calcolati secondo le regole dichiarate: modificatore delle sei caratteristiche, bonus di competenza, valore dei tiri salvezza, valore delle abilità, Percezione passiva e iniziativa. SHALL gestire come collezioni ripetibili: attacchi, ciascuno con nome, attivazione e parametri del tiro di attacco (caratteristica, bonus aggiuntivo, competenza), gittata, bonus magico, soglia di critico, due blocchi di danno con attivazione, formula del dado, caratteristica, bonus, tipo di danno e dado di critico, attivazione e parametri del tiro salvezza (caratteristica e CD), effetto del salvataggio e descrizione; oggetti di equipaggiamento con quantità, nome e peso; strumenti e competenze con nome, tipo di competenza fra `Proficient`, `Expertise` e `None`, attributo fra le sei caratteristiche o nessuno e bonus aggiuntivo; linguaggi con il solo nome; privilegi e tratti con nome, fonte fra `Razziale`, `Classe`, `Talento`, `Background`, `Oggetto` e `Altro` e descrizione; sezioni di risorse, ciascuna composta dai due blocchi fissi `Risorsa di classe` e `Altra risorsa` con nome, totale e attuale. Attacchi e strumenti SHALL essere modificati dal proprio editor dedicato anziché da campi affiancati nella riga. SHALL NOT offrire una sezione Azioni né la moneta Electrum.

#### Scenario: Modifica dei valori di combattimento

- **WHEN** il proprietario o il Master modifica punti ferita, Classe Armatura, velocità o una moneta
- **THEN** il sistema conserva esattamente i valori inseriti senza ricalcolarli automaticamente

#### Scenario: Modifica di un input di un valore derivato

- **WHEN** il proprietario o il Master modifica un punteggio di caratteristica, il livello, una competenza o un bonus vari
- **THEN** il sistema conserva l'input come inserito e aggiorna i valori che le regole ne derivano

#### Scenario: Aggiunta di elementi oltre le righe iniziali

- **WHEN** un utente autorizzato aggiunge attacchi, oggetti, strumenti, linguaggi, privilegi o sezioni di risorse
- **THEN** la scheda crea ulteriori elementi modificabili singolarmente e rimovibili, senza un limite derivato dal layout del PDF

#### Scenario: Filtro dei privilegi e tratti

- **WHEN** l'utente digita un testo nel filtro dei privilegi e tratti
- **THEN** l'elenco mostra soltanto i privilegi il cui nome o descrizione contiene quel testo, senza modificare i dati della scheda

#### Scenario: Documento salvato prima della riorganizzazione

- **WHEN** viene caricata una scheda che contiene equipaggiamento, competenze e linguaggi o privilegi come testo unico, azioni oppure monete Electrum
- **THEN** il sistema converte i testi riconosciuti nella prima riga della collezione corrispondente e scarta i campi non più previsti senza rifiutare il documento

#### Scenario: Attacchi e strumenti salvati prima degli editor

- **WHEN** viene caricata una scheda i cui attacchi hanno bonus, danno o tipo e note come testo unico, oppure i cui strumenti hanno un modificatore testuale
- **THEN** il sistema riporta ogni valore esistente nel campo corrispondente del nuovo modello, lascia i campi nuovi ai valori predefiniti previsti e non perde né rifiuta alcun dato inserito

#### Scenario: Valori scritti a mano prima dell'introduzione delle regole

- **WHEN** viene caricata una scheda i cui modificatori di caratteristica, bonus di competenza, valori dei tiri salvezza e valori delle abilità erano stati scritti a mano
- **THEN** il sistema ricava gli input del calcolo dai valori esistenti e deposita nel bonus vari della riga la differenza che le regole non spiegano, in modo che ogni totale visibile prima della conversione resti identico dopo

#### Scenario: Tipo di dado vita salvato come testo libero

- **WHEN** viene caricata una scheda il cui tipo di dado vita non appartiene all'insieme `d4`, `d6`, `d8`, `d10`, `d12`
- **THEN** il sistema riconduce il valore al dado corrispondente quando è riconoscibile e altrimenti lo riporta allo stato «non scelto», senza rifiutare il documento

### Requirement: Dati di aspetto e storia

La tab `Aspetto e storia` SHALL rendere manualmente modificabili: nome; età; altezza; peso; occhi; pelle; capelli; aspetto; alleati e organizzazioni; nome testuale della fazione; storia; privilegi aggiuntivi; tesori. La tab SHALL NOT offrire l'upload di un'immagine della fazione.

#### Scenario: Compilazione della storia

- **WHEN** un utente autorizzato compila aspetto, storia, alleati, fazione o tesori
- **THEN** i testi inseriti restano associati alla scheda e sono disponibili alle successive aperture

#### Scenario: Fazione senza allegato

- **WHEN** l'utente compila il nome della fazione
- **THEN** il sistema accetta il testo senza richiedere né offrire un'immagine della fazione

### Requirement: Dati degli incantesimi

La tab `Incantesimi` SHALL rendere manualmente modificabili la classe da incantatore come testo e la caratteristica da incantatore, scelta fra le sei caratteristiche o non scelta. SHALL mostrare come valori di sola lettura, calcolati secondo le regole dichiarate, la CD del tiro salvezza e il bonus di attacco da incantatore, ciascuno con il proprio campo bonus vari. SHALL gestire trucchetti e incantesimi di livello 1-9 come elementi ripetibili, con stato preparato o conosciuto, e SHALL gestire slot totali e rimanenti per ciascun livello applicabile. Le righe dei singoli incantesimi SHALL NOT diventare bersagli di tiro in P0.5.

#### Scenario: Compilazione degli incantesimi

- **WHEN** un utente autorizzato aggiunge incantesimi, cambia il loro stato o aggiorna gli slot
- **THEN** la tab conserva i valori manuali per ciascun livello senza applicare regole automatiche di classe o livello

#### Scenario: Aggiunta oltre le righe del PDF

- **WHEN** un livello contiene più incantesimi delle righe presenti nel PDF di riferimento
- **THEN** l'utente può aggiungere ulteriori elementi ripetibili nella stessa sezione

#### Scenario: Scelta della caratteristica da incantatore

- **WHEN** un utente autorizzato sceglie Carisma come caratteristica da incantatore su un personaggio di livello `5` con Carisma `16`
- **THEN** il bonus di attacco da incantatore vale `+6` e la CD del tiro salvezza vale `14`

#### Scenario: Caratteristica da incantatore non scelta

- **WHEN** la caratteristica da incantatore non è scelta
- **THEN** CD e bonus di attacco da incantatore mostrano un segnaposto neutro e la scheda non registra alcun valore derivato

#### Scenario: Valori da incantatore salvati come testo

- **WHEN** viene caricata una scheda che ha caratteristica da incantatore come testo libero, CD e bonus di attacco scritti a mano
- **THEN** il sistema riconosce la caratteristica quando il testo la nomina e deposita nei rispettivi bonus vari la differenza che le regole non spiegano, così che i due valori visibili restino identici; se il testo non nomina una caratteristica riconoscibile, la caratteristica resta non scelta e i due valori mostrano il segnaposto senza reinterpretare i numeri precedenti

### Requirement: Compilazione manuale senza importazioni

Gli input della scheda SHALL essere compilabili manualmente per supportare regole personalizzate, e ogni valore che le regole 5e non determinano SHALL restare interamente a disposizione di chi compila. La scheda SHALL NOT importare PDF, JSON, schede di altri VTT o allegati generici e SHALL NOT automatizzare l'avanzamento di livello. I valori che le regole determinano SHALL essere calcolati e di sola lettura secondo il requisito dei valori derivati, e lo scostamento dalle regole standard SHALL passare dai campi bonus vari previsti anziché dalla riscrittura del totale. I tiri dalla scheda sono definiti dalla capability `character-sheet-roll-actions`.

#### Scenario: Inserimento di un valore homebrew

- **WHEN** un utente autorizzato inserisce un valore o un testo non derivabile dalle regole standard in un campo non calcolato
- **THEN** il sistema lo accetta e lo conserva come inserito

#### Scenario: Scostamento dalle regole su un valore calcolato

- **WHEN** il tavolo applica a un'abilità o a un tiro salvezza un bonus che le regole standard non prevedono
- **THEN** l'utente lo inserisce nel bonus vari della riga e il totale mostrato lo include, senza che il calcolo venga disattivato

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

Le modifiche accettate a nome, punti ferita massimi, attuali e temporanei e velocità SHALL aggiornare i valori corrispondenti del token associato. Il modificatore di iniziativa proiettato sul token SHALL essere quello calcolato dalle regole: il sistema SHALL ricalcolarlo e proiettarlo quando cambia il punteggio di Destrezza o il bonus vari dell'iniziativa, e SHALL NOT proiettare un valore di iniziativa scritto a mano. Il ritratto e la Classe Armatura SHALL restare dati della scheda e SHALL NOT essere copiati automaticamente sul token.

#### Scenario: Aggiornamento di un valore condiviso

- **WHEN** un utente autorizzato modifica nella scheda un valore collegato al token
- **THEN** il token associato riceve il nuovo valore senza richiedere un aggiornamento della pagina

#### Scenario: Aggiornamento dell'iniziativa per via indiretta

- **WHEN** un utente autorizzato cambia il punteggio di Destrezza o il bonus vari dell'iniziativa
- **THEN** il token riceve il modificatore di iniziativa ricalcolato, senza che alcun campo di iniziativa venga scritto nella scheda

#### Scenario: Aggiornamento di un valore non condiviso

- **WHEN** un utente modifica il ritratto o la Classe Armatura
- **THEN** il token non viene modificato da quel cambiamento

### Requirement: Valori derivati dalle regole 5e

La scheda SHALL calcolare dalle regole i valori che le regole determinano, e SHALL conservare come dati soltanto gli input di quel calcolo. Le regole SHALL essere:

- modificatore di caratteristica: parte intera inferiore di `(punteggio − 10) ÷ 2`;
- bonus di competenza: `2 + parte intera inferiore di ((livello − 1) ÷ 4)`;
- valore di un tiro salvezza: modificatore della caratteristica, più il bonus di competenza se competente, più il bonus vari della riga;
- valore di un'abilità: modificatore della caratteristica associata dalle regole, più il bonus di competenza se competente o il suo doppio se esperto, più il bonus vari della riga;
- Percezione passiva: `10` più il valore dell'abilità Percezione;
- iniziativa: modificatore di Destrezza più il bonus vari dell'iniziativa;
- bonus di uno strumento: come il valore di un'abilità, sulla caratteristica scelta nel suo editor;
- bonus di attacco: modificatore della caratteristica scelta, più il bonus di competenza se l'attacco è competente, più bonus magico e bonus aggiuntivo;
- CD del tiro salvezza da incantatore: `8` più il bonus di competenza, più il modificatore della caratteristica da incantatore, più il proprio bonus vari;
- bonus di attacco da incantatore: bonus di competenza, più il modificatore della caratteristica da incantatore, più il proprio bonus vari.

Il punteggio di ogni caratteristica SHALL essere un intero, SHALL valere `10` in una scheda nuova e SHALL essere l'unico campo modificabile della coppia punteggio-modificatore. Il modificatore SHALL essere di sola lettura in ogni condizione: né l'interfaccia né le API SHALL offrire un modo di scriverlo o di sostituire la regola che lo produce. Il livello SHALL essere un intero e SHALL valere `1` in una scheda nuova. Ogni tiro salvezza, ogni abilità, l'iniziativa, la CD del tiro salvezza da incantatore e il bonus di attacco da incantatore SHALL avere un campo **bonus vari**, vuoto per impostazione predefinita, che si somma al valore calcolato. Quando la caratteristica da incantatore non è scelta, i due valori da incantatore SHALL mostrare un segnaposto neutro anziché un numero calcolato senza il suo modificatore. Il server SHALL rifiutare una richiesta che scriva un valore derivato e SHALL rifiutare un punteggio o un livello non intero.

#### Scenario: Scheda nuova

- **WHEN** viene creata una scheda vuota
- **THEN** ogni caratteristica vale `10` con modificatore `+0`, il livello vale `1` e il bonus di competenza vale `2`

#### Scenario: Modifica di un punteggio di caratteristica

- **WHEN** un utente autorizzato porta il punteggio di Destrezza a `16`
- **THEN** il modificatore di Destrezza diventa `+3` e lo stesso valore compare nelle abilità basate su Destrezza, nei suoi tiri salvezza e nell'iniziativa senza altre modifiche

#### Scenario: Il modificatore non è scrivibile

- **WHEN** un utente cerca di modificare il modificatore di una caratteristica dall'interfaccia, oppure una richiesta tenta di scrivere un valore derivato tramite le API
- **THEN** l'interfaccia non offre alcun campo modificabile e il server rifiuta la richiesta senza modificare lo stato della scheda

#### Scenario: Cambio di livello

- **WHEN** un utente autorizzato porta il livello del personaggio a `5`
- **THEN** il bonus di competenza diventa `3` e i valori di tiri salvezza competenti, abilità competenti, strumenti competenti e attacchi competenti cambiano di conseguenza

#### Scenario: Bonus vari per il non standard

- **WHEN** un utente autorizzato inserisce `1` come bonus vari della riga Furtività
- **THEN** il valore di Furtività aumenta esattamente di uno rispetto al calcolo dalle regole, e gli altri valori restano invariati

#### Scenario: Input non interpretabile

- **WHEN** il livello non è interpretabile come intero
- **THEN** il bonus di competenza e i valori che ne dipendono mostrano un segnaposto neutro, la scheda non registra alcun valore derivato e nessun numero viene inventato

### Requirement: Competenza a tre livelli per abilità e tiri salvezza

Ogni abilità SHALL dichiarare la competenza su tre livelli: nessuna competenza, competente ed esperto. L'indicatore della riga SHALL ciclare fra i tre livelli a click successivi, nell'ordine nessuna competenza, competente, esperto e di nuovo nessuna competenza, e SHALL essere azionabile da tastiera con lo stato corrente esposto alle tecnologie assistive. Ogni tiro salvezza SHALL dichiarare la competenza su due stati, competente o no, perché le regole non prevedono l'esperienza sui tiri salvezza. Il livello dichiarato SHALL essere l'input del calcolo del valore della riga.

#### Scenario: Ciclo dei tre livelli

- **WHEN** un utente autorizzato usa ripetutamente l'indicatore di competenza di un'abilità
- **THEN** il livello passa da nessuna competenza a competente, poi a esperto, poi di nuovo a nessuna competenza

#### Scenario: Effetto dell'esperienza sul valore

- **WHEN** un'abilità passa da competente a esperto
- **THEN** il suo valore somma il doppio del bonus di competenza al posto del bonus semplice

#### Scenario: Tiri salvezza senza esperienza

- **WHEN** un utente autorizzato dichiara la competenza di un tiro salvezza
- **THEN** l'indicatore alterna soltanto competente e non competente, senza offrire l'esperienza

### Requirement: Editor dedicato per attacchi, strumenti e competenze

Gli attacchi e gli elementi di strumenti e competenze SHALL essere creati e modificati in un editor dedicato aperto sopra la scheda, non compilando direttamente la riga dell'elenco. L'editor di un attacco SHALL raccogliere: nome; attivazione del tiro di attacco con caratteristica fra le sei, bonus aggiuntivo e competenza; gittata; bonus magico; soglia di critico; il primo blocco di danno, sempre attivo, con formula del dado, caratteristica, bonus, tipo di danno scelto da un elenco chiuso 5e e dado di critico; un secondo blocco di danno con gli stessi campi e la propria attivazione; attivazione del tiro salvezza con caratteristica e CD; effetto del salvataggio riuscito; descrizione. L'editor di uno strumento SHALL raccogliere nome, livello di competenza, caratteristica associata e bonus aggiuntivo. L'editor SHALL offrire conferma, annullamento e rimozione dell'elemento. La conferma SHALL riportare l'utente all'elenco con l'elemento aggiornato; l'annullamento SHALL lasciare l'elemento nello stato precedente all'apertura. Un blocco disattivato SHALL conservare i valori inseriti al suo interno. La scheda SHALL NOT esporre i campi dell'editor come campi dell'elenco.

#### Scenario: Aggiunta di un attacco

- **WHEN** un utente autorizzato usa il comando di aggiunta nella sezione degli attacchi
- **THEN** si apre l'editor di un nuovo attacco con i valori predefiniti previsti, il primo blocco di danno già attivo, e nessun campo dell'attacco viene chiesto nella riga dell'elenco

#### Scenario: Conferma delle modifiche

- **WHEN** l'utente compila o cambia campi nell'editor e conferma
- **THEN** l'elenco mostra l'elemento aggiornato e i valori confermati restano disponibili alla riapertura dell'editor

#### Scenario: Annullamento delle modifiche

- **WHEN** l'utente cambia campi nell'editor e annulla
- **THEN** l'elemento resta come era prima dell'apertura dell'editor e nessuna modifica di quei campi risulta salvata

#### Scenario: Rimozione dall'editor

- **WHEN** l'utente rimuove l'elemento dall'editor e l'operazione viene accettata
- **THEN** l'elemento scompare dall'elenco senza alterare gli altri elementi della stessa collezione

#### Scenario: Blocco disattivato

- **WHEN** l'utente disattiva il tiro di attacco, il secondo blocco di danno o il tiro salvezza e conferma
- **THEN** i valori di quel blocco restano memorizzati e tornano visibili riattivandolo, mentre la riga compatta non ne mostra il contributo

#### Scenario: Stesso modello per strumenti e competenze

- **WHEN** un utente autorizzato aggiunge o modifica uno strumento
- **THEN** l'operazione avviene nell'editor dedicato con gli stessi comandi di conferma, annullamento e rimozione degli attacchi

### Requirement: Riga compatta con valori derivati

Confermato un elemento, la sezione SHALL mostrarlo come riga compatta sotto un'intestazione che nomina le colonne. La riga di un attacco SHALL mostrare nome, bonus di attacco e danno con il relativo tipo, con il modificatore di danno calcolato incluso nella formula mostrata; la riga di uno strumento SHALL mostrare nome e bonus risultante. I valori numerici della riga SHALL essere derivati secondo le regole dichiarate e SHALL NOT essere campi modificabili né valori salvati a sé. Quando i campi coinvolti non permettono un calcolo, la riga SHALL mostrare un segnaposto neutro senza scrivere alcun valore nella scheda. La riga SHALL offrire un comando a ingranaggio che riapre l'editor dell'elemento.

#### Scenario: Attacco confermato nell'elenco

- **WHEN** un utente conferma un attacco con tiro e danno attivi
- **THEN** la riga compatta mostra nome, bonus di attacco e danno/tipo calcolati dai campi dell'editor, con il modificatore di danno incluso nella formula (per esempio `1d6+3`)

#### Scenario: Riapertura dall'ingranaggio

- **WHEN** l'utente usa l'ingranaggio di una riga
- **THEN** si riapre l'editor di quell'elemento con i valori correnti

#### Scenario: Valore non calcolabile

- **WHEN** i campi dell'editor non consentono di calcolare bonus o danno, per esempio perché un bonus vari non è numerico
- **THEN** la riga mostra un segnaposto neutro, resta leggibile e la scheda non registra alcun valore derivato

#### Scenario: Aggiornamento di un campo di partenza

- **WHEN** cambia un valore da cui il calcolo dipende, come il punteggio di una caratteristica o il livello del personaggio
- **THEN** la riga compatta mostra il nuovo risultato senza richiedere una modifica dell'elemento

### Requirement: Blocco delle sezioni di azioni contro le modifiche accidentali

Le sezioni degli attacchi e di strumenti e competenze SHALL offrire un comando di blocco. A sezione bloccata SHALL restare disponibile la lettura delle righe e SHALL NOT essere disponibili aggiunta, apertura dell'editor in modifica e rimozione. Lo stato del blocco SHALL essere un dato della scheda, sincronizzato e persistito come gli altri, e SHALL NOT sostituire i controlli di autorizzazione: chi non può modificare la scheda resta senza permesso anche a sezione sbloccata, e chi può modificarla può sempre sbloccarla.

#### Scenario: Sezione bloccata

- **WHEN** un utente autorizzato blocca la sezione degli attacchi
- **THEN** le righe restano leggibili e i comandi di aggiunta, modifica e rimozione non sono disponibili

#### Scenario: Sblocco della sezione

- **WHEN** un utente autorizzato sblocca la sezione
- **THEN** i comandi di aggiunta, modifica e rimozione tornano disponibili

#### Scenario: Blocco condiviso fra finestre autorizzate

- **WHEN** il proprietario blocca una sezione mentre il Master ha la scheda aperta
- **THEN** la finestra del Master riflette lo stato di blocco senza ricaricare la pagina e il Master può sbloccarla

#### Scenario: Il blocco non concede permessi

- **WHEN** un Adventurer diverso dal proprietario tenta di modificare una sezione sbloccata di quella scheda
- **THEN** il sistema nega l'operazione come già previsto dai permessi della scheda

### Requirement: Riquadro dei dadi vita e contatori dei salvataggi contro morte

Il riquadro dei dadi vita SHALL mostrare il totale nella parte alta e i dadi rimasti nella parte bassa come valore principale, e SHALL far scegliere il tipo di dado da un insieme chiuso composto da uno stato iniziale «non scelto» e dai dadi `d4`, `d6`, `d8`, `d10` e `d12`. I successi e i fallimenti dei tiri salvezza contro morte SHALL essere contatori da 0 a 3, resi come tre indicatori per riga, modificabili a mano dall'utente autorizzato. Il server SHALL rifiutare un tipo di dado fuori dall'insieme e un contatore fuori dall'intervallo senza modificare lo stato della scheda.

#### Scenario: Scelta del tipo di dado vita

- **WHEN** un utente autorizzato sceglie il tipo di dado vita
- **THEN** può selezionare soltanto lo stato «non scelto» oppure uno fra `d4`, `d6`, `d8`, `d10` e `d12`, e il valore scelto resta associato alla scheda

#### Scenario: Valore fuori dominio

- **WHEN** una richiesta imposta un tipo di dado vita non compreso nell'insieme oppure un contatore di successi o fallimenti fuori dall'intervallo da 0 a 3
- **THEN** il server rifiuta la modifica con un errore leggibile e lo stato della scheda resta invariato

#### Scenario: Conteggio manuale dei salvataggi contro morte

- **WHEN** un utente autorizzato riempie o svuota un indicatore di successo o di fallimento
- **THEN** il contatore corrispondente cambia di uno e resta compreso fra 0 e 3
