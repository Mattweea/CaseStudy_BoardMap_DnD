# Roadmap VTT — core loop

## Obiettivo

Rendere l'app utilizzabile per completare un incontro come in un VTT: il giocatore apre la scheda, tira i dadi, muove il token, segue il turno e aggiorna le proprie risorse; il master prepara la mappa e gestisce il combattimento. Il riferimento è il [flusso di gioco essenziale di Roll20](https://help.roll20.net/hc/en-us/articles/29258224833431-10-Using-Roll20-to-play), non la replica di tutte le sue funzioni.

## Base già presente

Il progetto include token e ostacoli, ruoli master/player, sincronizzazione SSE, movimento dei player, HP, alcune condizioni, dadi, iniziativa, luci, visione, undo e snapshot manuali. Le voci seguenti indicano funzioni mancanti oppure comportamenti da completare e verificare; non sostituiscono un test funzionale con più client.

## P0 — indispensabile per una sessione

P0.1 prepara il database, P0.2 rende stabili identità e ruoli, P0.3 organizza la GUI di sessione e P0.4 rende persistenti le schede. Le feature successive seguono l'utilità immediata per i giocatori; non costituiscono una sequenza rigida di implementazione. Il traguardo P0 è poter giocare un incontro completo su una mappa condivisa.

In ogni feature, **Players** indica gli utenti con ruolo tecnico `adventurer`, mentre **Master** indica il ruolo `master`. **Sistema** raccoglie i requisiti condivisi, inclusi permessi, sincronizzazione e persistenza. Per ora non è previsto un ruolo Admin.

### P0.1 — SQLite e migrazioni versionate

**Sistema**

- [x] Creare un database SQLite locale in `database/database.sqlite`, con percorso configurabile tramite `VTT_DB_PATH` e file escluso da Git.
- [x] Organizzare il sistema in `database/`: connessione e configurazione condivise, runner delle migrazioni e cartella `migrations/` versionata nel repository.
- [x] Dare a ogni migrazione un nome ordinabile (per esempio `20260914_001_create_character_sheets.mjs`) e due operazioni `up` e `down`, sul modello delle [migrazioni Laravel](https://laravel.com/framework/docs/12.x/migrations).
- [x] Registrare le migrazioni eseguite in una tabella `schema_migrations` con nome, batch, data e checksum. Eseguire solo quelle mancanti, nell'ordine previsto, rilevando file modificati o rimossi.
- [x] Eseguire ogni migrazione e la registrazione del suo esito nella stessa transazione; se fallisce, lasciare il database alla versione precedente e segnalare l'errore.
- [x] Esporre comandi npm `db:make`, `db:migrate`, `db:status` e `db:rollback` per generare un file, applicare, verificare e annullare l'ultimo batch di migrazioni.
- [x] Creare con le prime migrazioni le tabelle per utenti, campagne, sessioni e schede; scene, token, combattimento, chat e log arriveranno con le rispettive feature.
- [x] Definire chiavi esterne, indici e vincoli; abilitare esplicitamente le foreign key SQLite e verificare WAL e busy timeout a ogni connessione.
- [x] Mantenere i dati variabili della scheda in JSON valido senza rinunciare a colonne e relazioni per proprietario, campagna, versione e date di modifica.
- [x] Non modificare migrazioni già applicate: ogni successivo cambio di schema deve avere un nuovo file. Considerare le limitazioni di [`ALTER TABLE` in SQLite](https://www.sqlite.org/lang_altertable.html) quando si scrive `down`.

**Struttura prevista:**

```text
database/
  cli.mjs
  connection.mjs
  migrator.mjs
  migrations/
    20260914_001_create_users.mjs
    20260914_002_create_campaigns.mjs
    20260914_003_create_sessions.mjs
    20260914_004_create_character_sheets.mjs
  database.sqlite            # dato locale, non versionato
```

**Stato attuale:** completato. Sono disponibili database locale, migrazioni versionate, controlli d'integrità, rollback dell'ultimo batch e schema iniziale. P0.2 ha collegato login e utenti al database; P0.4 userà il database per le schede. La persistenza delle sessioni di login e dello stato live della partita resta in P0.11.

**Accettazione:** su un checkout pulito `npm run db:migrate` crea il database e le tabelle; rilanciarlo non modifica nulla. Una nuova migrazione si applica una sola volta, `db:status` ne mostra lo stato e `db:rollback` annulla l'ultimo batch in un database di sviluppo.

### P0.2 — Ruoli e login del roster

**Decisioni confermate:** mantenere il roster attuale e soltanto i ruoli `master` e `adventurer` (Player nell'interfaccia), senza Admin né registrazione libera. La password iniziale letterale `password` è comune a tutti i profili e viene conservata solo come hash bcrypt. Nell'uso locale tra amici questo facilita l'accesso, ma chi conosce la password può entrare come un altro profilo: i ruoli non garantiscono un'identità riservata. Le sessioni di login possono restare in memoria; dopo il riavvio del server si effettua nuovamente il login.

**Players**

- [x] Selezionare il proprio profilo del roster, inserire la password e accedere con uno stato di errore chiaro in caso di credenziali non valide.
- [x] Ritrovare il proprio profilo e i relativi permessi dopo un refresh del browser finché la sessione è valida; poter uscire con logout.

**Master**

- [x] Accedere con il profilo Master e conservare i controlli della mappa riservati a questo ruolo.

**Sistema**

- [x] Creare `roles` prima di `users`, con codici univoci `master` e `adventurer`, e collegare `users` a `roles` tramite chiave esterna senza due fonti di verità per il ruolo.
- [x] Inizializzare in SQLite gli utenti del roster con ID stabili, ruolo e hash bcrypt della password comune; mantenere i profili statici soltanto per i dati di presentazione e di gioco ancora necessari.
- [x] Leggere gli utenti dal database durante il login, verificare la password con bcrypt e derivare ruolo e permessi dall'utente autenticato sul server, senza fidarsi del ruolo inviato dal client.
- [x] Aggiornare il frontend del login per il roster esistente: scelta tramite `@username`, password mostrata solo dopo la selezione, stati di caricamento/errore, sessione e logout comprensibili.
- [x] Conservare in P0.2 le sessioni attive in memoria; la loro persistenza o il rinnovo automatico dopo il riavvio appartiene a P0.11.

**Stato attuale:** completato: la baseline crea in ordine `schema_migrations`, `roles`, `users`, campagne, sessioni e schede. `db:fresh` rigenera il database di sviluppo e il roster è inserito con hash bcrypt durante la migrazione utenti; le API risolvono l'identità della sessione dal database. Le sessioni restano in memoria e il frontend richiede esplicitamente la password comune dopo la scelta di `@username`.

**Accettazione:** dopo `db:migrate` e l'inizializzazione del roster, Master e Player accedono dal frontend con `password`; le vecchie credenziali non funzionano. Refresh e logout funzionano; il server continua a distinguere i permessi Master/Player anche se il client invia un ruolo diverso. Non compaiono account o interfacce Admin.

### P0.3 — GUI di sessione: mappa, pannello, dadi e turni

**Riferimenti UI:** reference 1 per la composizione mappa/pannello e reference 2 per i controlli di selezione dei dadi, adattati a una sezione integrata in basso nel pannello destro con modale compatta di configurazione sulla mappa. Sono riferimenti di struttura e interazione, non una richiesta di copiare ogni funzione mostrata nelle immagini.

**Players**

- [x] Vedere la mappa a sinistra e un pannello richiudibile a destra, per circa un quarto della larghezza desktop.
- [x] Usare sulla mappa i pulsanti visibili **Zoom in (+)** e **Zoom out (−)** e conservare le interazioni già presenti col mouse: spostamento della visuale con Ctrl+trascinamento o tasto centrale e trascinamento dei token che il proprio ruolo può muovere.
- [x] Navigare fra quattro tab nella parte alta del pannello: **Chat + Dadi**, **Turni di iniziativa**, **Personaggi**, **Legenda dei comandi**. La tab Chat + Dadi mostra per ora il log dei tiri; la chat testuale tra partecipanti è rinviata a P2.6.
- [x] Lanciare dadi dai controlli a click integrati in basso nel pannello destro, con click sinistro per aggiungere e click destro per rimuovere; il pulsante **Tira** apre una modale compatta sulla mappa per modificatore positivo o negativo, modalità e visibilità. Il comando `/r 1d20+5` è inviato con Invio e un comando non valido mostra un errore senza produrre un tiro.
- [x] Scegliere tiro **pubblico**, visibile a tutti, o **segreto**, visibile solo all'autore e al Master; il log si aggiorna in tempo reale e distingue chiaramente i due tipi.
- [x] Vedere l'ordine di iniziativa dal valore più alto al più basso. Quando il turno attivo precede il proprio, vedere una volta la modale **«Sei il prossimo!»**; quando inizia il proprio turno, vedere una volta **«Tocca a te!»**.
- [x] Consultare nella tab Personaggi il roster disponibile, con nome, immagine e collegamento al token in mappa; l'apertura della scheda da questa lista arriverà con P0.4.

**Master**

- [x] Usare lo stesso pannello per consultare il log dei dadi, l'ordine dei turni e la lista dei personaggi, mantenendo zoom e selettore scena; i controlli Master non richiesti restano nel codice ma sono nascosti dalla GUI.
- [x] Vedere i tiri segreti dei player oltre ai propri, senza renderli visibili agli altri player.

**Sistema**

- [x] Riorganizzare la sidebar sinistra esistente in un pannello destro con tab accessibili da tastiera; mantenere zoom, selettore scena e permessi attuali sui token, nascondendo dalla GUI i controlli di sessione, azioni e luce non richiesti senza eliminarne il codice.
- [x] Su schermi stretti usare il pannello come overlay richiudibile, mantenendo la mappa utilizzabile e le tab navigabili.
- [x] Validare e calcolare sul server i tiri da click e da comando con la stessa logica, associandoli all'utente autenticato; distribuire i tiri segreti solo ai destinatari autorizzati anche nelle risposte HTTP e negli aggiornamenti SSE.
- [x] Riutilizzare lo stato di iniziativa già presente per ordinamento visivo, evidenziazione del turno e modali legate alle transizioni. In P0.3 non aggiungere il tiro dalla scheda né nuove regole di inserimento o calcolo dell'iniziativa; queste arrivano dopo la scheda, in P0.8.
- [x] Riutilizzare e adattare la legenda dei comandi già presente, aggiungendo la sintassi dei tiri da comando.

**Stato attuale:** completato. La mappa affianca il pannello destro a quattro tab, i dadi sono calcolati autorevolmente dal server e il log è sincronizzato con SSE. I tiri pubblici e segreti sono filtrati per destinatario; log, iniziativa e avvisi turno sono disponibili senza chat testuale.

**Accettazione:** verificata con build e sessioni Master/Player. Su desktop la mappa occupa circa il 75% e il pannello destro circa il 25%; le quattro tab, zoom, spostamento della visuale e trascinamento dei token consentiti funzionano con pannello aperto o richiuso. I dadi sono configurati in una modale sulla mappa e disponibili da tutte le tab; due client vedono lo stesso tiro pubblico da click o `/r 1d20+5`, mentre un tiro segreto è visibile solo all'autore e al Master. Il log si aggiorna via SSE e mantiene visibile l’ultimo tiro. Con un ordine impostato, il Player riceve le due modali al cambio di turno. La chat testuale resta fuori da P0.3.

### P0.4 — Scheda personale Roll20 a tre tab

**Riferimenti UI e funzionali:** la scheda segue il flusso di Roll20: si apre dalla tab **Personaggi** di P0.3 in una finestra ampia sopra la sessione, si può chiudere senza perdere il contesto della mappa e mantiene una struttura compatta da consultare e modificare durante il gioco. I campi derivano dal [5E_CharacterSheet_Fillable.pdf](./5E_CharacterSheet_Fillable.pdf), composto da tre pagine e 334 campi form. Il PDF definisce contenuti e raggruppamenti, ma l'interfaccia web non deve riprodurne l'impaginazione pixel per pixel.

**Confine degli import:** non importare PDF, JSON, schede di altri VTT o altri file di dati e non conservare allegati generici. L'unico upload previsto in P0.4 è il ritratto del personaggio, sostituibile in qualsiasi momento dal proprietario. La scheda viene compilata direttamente nell'app.

**Modello della scheda:** per la campagna corrente esiste una sola scheda attiva per ciascun utente `adventurer` del roster. Al primo accesso la scheda vuota viene inizializzata e collegata al proprietario e al relativo token. Tutti i valori restano modificabili manualmente per supportare decisioni del tavolo e homebrew; P0.4 non calcola automaticamente regole, level up o tiri.

**Architettura prevista:** repository espliciti per l'accesso e la mappatura dei dati, policy per autorizzare proprietario e Master, service per validazione, patch, sincronizzazione live e persistenza. Usare `character_sheets.version` per il controllo di concorrenza; non introdurre una gerarchia di Model in stile Eloquent né un ORM completo.

**Sincronizzazione e salvataggio:** ogni modifica valida viene inviata al server come patch del campo, applicata allo stato live autorevole e distribuita subito via SSE ai client autorizzati. Il client mostra gli stati **Modifica in corso**, **Salvataggio** e **Salvato**, conserva localmente l'input mentre la richiesta è in corso e segnala gli errori senza fingere che il dato sia salvato. Per evitare scritture SQLite a ogni tasto, il server raggruppa le modifiche della singola scheda con un debounce breve (obiettivo 1 secondo) e forza il flush su cambio campo, chiusura della scheda, logout e fine sessione. Non attendere esclusivamente la fine della sessione: un crash non deve poter perdere l'intera scheda modificata.

**Players**

- [x] Aprire la propria scheda dalla tab Personaggi in una finestra sopra la sessione, passare fra le tre tab e tornare alla mappa senza perdere modifiche o posizione di consultazione.
- [x] Caricare, visualizzare e sostituire soltanto il ritratto del proprio personaggio. Accettare immagini JPEG, PNG o WebP fino a 5 MB; il ritratto aggiornato compare nella scheda e nella tab Personaggi. Non usare automaticamente il ritratto come immagine del token.
- [x] Usare la tab **Personaggio e combattimento** (pagina 1) per modificare: nome; classe; sottoclasse; livello; razza; background; allineamento; punti esperienza; ispirazione; bonus di competenza; sei caratteristiche e modificatori; competenze e valori dei tiri salvezza; competenze e valori delle abilità; Percezione passiva; CA; iniziativa; velocità; HP massimi, correnti e temporanei; tipo, totale e dadi vita rimanenti; successi e fallimenti contro morte; attacchi ripetibili con nome, bonus, danno/tipo e note; monete CP/SP/GP/PP; equipaggiamento, strumenti e lingue come collezioni ripetibili; tratti della personalità, ideali, legami, difetti; sezioni di risorse; privilegi e tratti. La sezione Azioni e la moneta Electrum sono state escluse.
- [x] Usare la tab **Aspetto e storia** (pagina 2) per modificare: nome; età; altezza; peso; occhi; pelle; capelli; descrizione dell'aspetto; alleati e organizzazioni; nome della fazione come testo; storia; privilegi e tratti aggiuntivi; tesori. Il riquadro del simbolo di fazione non introduce un secondo upload di immagini.
- [x] Usare la tab **Incantesimi** (pagina 3) per modificare: classe da incantatore; caratteristica da incantatore; CD dei tiri salvezza; bonus di attacco; trucchetti; incantesimi di livello 1–9; indicatore preparato/conosciuto; slot totali e slot rimanenti per livello. Le liste degli incantesimi sono ripetibili e non limitate al numero di righe visibili nel PDF.
- [x] Vedere immediatamente nella propria scheda le modifiche accettate dal server e uno stato chiaro quando una modifica è ancora in sincronizzazione o non è stata salvata.

**Master**

- [x] Aprire dalla tab Personaggi la scheda di ogni Player, consultarla e correggerla durante la sessione; le correzioni seguono lo stesso flusso live e di salvataggio del proprietario.
- [x] Vedere l'aggiornamento di una scheda già aperta senza ricaricare la pagina quando il proprietario modifica un campo o sostituisce il ritratto.

**Sistema**

- [x] Inizializzare la campagna locale corrente con il Master del roster e creare o recuperare in modo idempotente una sola scheda attiva per ogni `adventurer`; aggiungere con una nuova migrazione il vincolo univoco necessario per proprietario e campagna senza modificare migrazioni già applicate.
- [x] Modellare in `data_json` sezioni strutturate e collezioni ripetibili per attacchi, equipaggiamento, strumenti, lingue, privilegi, risorse e incantesimi, mantenendo colonne relazionali per proprietario, campagna, versione e date. Validare tipo, formato e limiti di ogni patch sul server.
- [x] Applicare patch per campo o elemento ripetibile, anziché sostituire l'intero documento, e usare la versione della scheda per riconoscere modifiche concorrenti. Modifiche a campi diversi non si sovrascrivono; una collisione sullo stesso campo restituisce lo stato corrente e un errore comprensibile da risolvere nell'interfaccia.
- [x] Verificare sul server i permessi di lettura e modifica: proprietario e Master possono leggere e modificare la scheda completa; gli altri Player ricevono soltanto i dati di presentazione già pubblici nel roster e non possono leggere o cambiare la scheda tramite API o SSE.
- [x] Gestire il ritratto come asset locale controllato dal server: verificare tipo e dimensione, generare il nome del file, impedire percorsi arbitrari e sostituire in sicurezza il file precedente dopo che il nuovo upload è valido.
- [x] Trasmettere subito via SSE le patch accettate ai soli client autorizzati, raggruppare la persistenza SQLite con debounce e forzare il flush nei punti di chiusura previsti. Dopo un errore di scrittura mantenere lo stato non salvato, ritentare senza perdere dati e mostrare l'errore ai client interessati.
- [x] Collegare la scheda al token con una mappatura esplicita per nome, HP massimi/correnti/temporanei, velocità e modificatore di iniziativa. Una modifica accettata aggiorna le viste collegate senza refresh; il ritratto e la CA restano dati della scheda finché una feature successiva non ne richiede l'uso sul token.

**Stato attuale:** completato e archiviato come change `p0-4-roll20-character-sheet`. La finestra è flottante e trascinabile sopra la sessione, con tre tab, patch per campo, sincronizzazione SSE, controllo di versione con gestione dei conflitti, persistenza SQLite raggruppata e upload del solo ritratto. Permessi verificati sul server per proprietario e Master; nome, HP, velocità e modificatore di iniziativa sono proiettati sul token. La resa grafica segue la direzione scura "Grimorio di brace", coerente con la sessione, con barra dei punti ferita puramente visiva e modificatore di caratteristica come valore primario. In sviluppo è disponibile un pulsante "Svuota scheda" per azzerare i campi. I tiri dalla scheda restano fuori: arrivano con P0.5.

**Accettazione:** un Player apre la propria scheda dalla tab Personaggi, compila campi in tutte e tre le tab e sostituisce il ritratto senza importare altri file. In una seconda finestra il Master vede gli aggiornamenti accettati senza refresh e può correggere un campo; un altro Player non riceve il contenuto della scheda. Digitazione rapida non produce una scrittura SQLite per ogni tasto, ma dopo circa un secondo di inattività lo stato risulta salvato; chiusura della scheda o fine sessione forza il flush. Dopo riavvio, campi e ritratto ricompaiono, e un conflitto sullo stesso campo viene segnalato senza cancellare modifiche non correlate.

### P0.5 — Tiri dalla scheda

**Perché conta:** lanciare un tiro dalla scheda è l'azione che Player e Master compiono più spesso durante una sessione. La qualità dell'interazione conta quanto la correttezza del risultato: un tiro tipico deve costare un solo click sull'elemento che lo rappresenta, senza passare dalla modale dei dadi liberi e senza perdere di vista la mappa.

**Due fasi ordinate:** la fase A porta nella scheda le regole di calcolo 5e, ridisegna la presentazione delle azioni e crea gli elementi su cui si clicca; la fase B aggiunge il motore dei tiri e il collegamento al log. La fase B non comincia prima che la fase A sia completa e verificata.

**Modello di interazione dei tiri (vale per tutta la fase B):** ogni elemento lanciabile è un bersaglio di click esplicito e riconoscibile, visivamente distinto dai campi di testo modificabili. Il click primario esegue subito il tiro con le impostazioni predefinite; un'interazione secondaria sullo stesso elemento apre la modale compatta di P0.3 per scegliere vantaggio, svantaggio, modificatore temporaneo e visibilità. Modificare un campo non deve poter far partire un tiro, e un tiro non deve poter modificare un campo, salvo i contatori esplicitamente previsti: dadi vita rimasti, successi e fallimenti contro morte.

#### Fase A — Regole calcolate, editor delle azioni e righe lanciabili

**Dalla compilazione manuale ai valori calcolati.** P0.4 lasciava ogni numero della scheda scritto a mano e vietava esplicitamente i calcoli automatici. La Fase A rovescia questa scelta per i valori che le regole 5e determinano senza ambiguità: se il motore dei tiri deve lanciare `1d20 + valore della cella`, quella cella non può essere un testo libero in cui si annida un errore di battitura. I valori restano visibili e verificabili, ma derivano dal punteggio di caratteristica, dal livello e dalla competenza dichiarata.

| Valore | Regola | Input |
| --- | --- | --- |
| Modificatore di caratteristica | parte intera inferiore di `(punteggio − 10) ÷ 2` | il punteggio della caratteristica, intero, `10` in una scheda nuova |
| Bonus di competenza | `2 + parte intera inferiore di ((livello − 1) ÷ 4)` | il livello del personaggio, intero, `1` in una scheda nuova |
| Tiro salvezza | modificatore della caratteristica, più il bonus di competenza se competente, più il bonus vari | punteggio, competenza, bonus vari |
| Abilità | modificatore della caratteristica associata, più il bonus di competenza se competente o il doppio se esperto, più il bonus vari | punteggio, livello di competenza, bonus vari |
| Percezione passiva | `10 +` il valore di Percezione | gli input di Percezione |
| Iniziativa | modificatore di Destrezza, più il bonus vari | punteggio di Destrezza, bonus vari |
| Bonus di uno strumento | come un'abilità, sulla caratteristica scelta nel suo editor | editor dello strumento |
| Bonus di attacco | modificatore della caratteristica, più il bonus di competenza se competente, più bonus magico e bonus aggiuntivo | editor dell'attacco |
| CD del tiro salvezza da incantatore | `8 +` bonus di competenza `+` modificatore da incantatore, più il bonus vari | caratteristica da incantatore, livello, bonus vari |
| Bonus di attacco da incantatore | bonus di competenza `+` modificatore da incantatore, più il bonus vari | caratteristica da incantatore, livello, bonus vari |

**Il modificatore di caratteristica non è modificabile.** La regola che lo lega al punteggio è fissa e non prevede eccezioni: il punteggio è l'unico campo compilabile della coppia e il modificatore è un valore di sola lettura, non un campo disabilitato. Né l'interfaccia né le API offrono un modo di scriverlo. Una scheda nuova parte da `10` in ogni caratteristica, quindi da `+0`, e non esistono caratteristiche prive di modificatore calcolabile.

**Via d'uscita per il non standard.** Ogni tiro salvezza, ogni abilità, l'iniziativa e i due valori da incantatore hanno un campo **bonus vari**, vuoto per default, che si somma al calcolo. È lì che finiscono l'oggetto magico che dà `+1` a Furtività e le regole della casa, senza rompere il calcolo e senza costringere a riscrivere il totale a mano. La cella mostra sempre il totale.

**Quando il calcolo non è possibile.** Un punteggio o un livello non interpretabile come numero non produce un valore inventato: la cella dipendente mostra un segnaposto neutro, la scheda non registra nulla e la Fase B rifiuta il tiro di quel bersaglio.

**Fuori dalla Fase A restano manuali:** Classe Armatura, velocità, punti ferita e peso totale dell'equipaggiamento. Dipendono da armatura ed equipaggiamento, che la scheda non modella ancora; automatizzarli richiederebbe dati che oggi non esistono.

**Rapporto con P0.4:** la Fase A sostituisce il modello a riga piatta di attacchi e strumenti, cambia la resa di dadi vita e tiri salvezza contro morte e toglie dal documento i valori che ora si calcolano. Le schede già compilate devono sopravvivere alla modifica: ogni totale oggi visibile resta identico dopo la conversione, e ciò che non deriva dalle regole finisce nel bonus vari della riga.

**Players**

- [x] Inserire il punteggio di ciascuna caratteristica, che parte da `10`, e leggere il modificatore calcolato come numero primario della cella. Il modificatore è di sola lettura e la sua regola non è modificabile né aggirabile.
- [x] Inserire il livello del personaggio, che parte da `1`, e leggere il bonus di competenza calcolato, usato da tiri salvezza, abilità, strumenti e attacchi competenti.
- [x] Dichiarare la competenza di un'abilità da un indicatore a tre stati sulla riga: un click rende competente, un secondo click rende esperto, un terzo torna a nessuna competenza. Il valore dell'abilità si aggiorna di conseguenza.
- [x] Dichiarare la competenza di un tiro salvezza dal suo indicatore e leggere il valore calcolato.
- [x] Inserire un bonus vari su un tiro salvezza, un'abilità o l'iniziativa per coprire oggetti e regole della casa, vedendolo sommato al totale mostrato.
- [x] Leggere Percezione passiva e Iniziativa come valori calcolati, non più come campi da compilare.
- [x] Scegliere la caratteristica da incantatore da una select nella tab Incantesimi e leggere CD del tiro salvezza e bonus di attacco calcolati, ciascuno con il proprio bonus vari. Senza caratteristica scelta i due valori restano vuoti anziché mostrare un numero incompleto.
- [x] Aggiungere un attacco aprendo un editor dedicato invece di compilare una riga di campi affiancati. L'editor raccoglie: nome; attivazione del tiro di attacco con caratteristica, bonus aggiuntivo e competenza; gittata; bonus magico; soglia di critico; attivazione del danno con formula del dado, caratteristica, bonus, tipo di danno e dado di critico; un secondo blocco di danno con gli stessi campi; attivazione del tiro salvezza con caratteristica e CD; effetto del salvataggio riuscito; descrizione.
- [x] Confermare o annullare le modifiche dell'editor. Alla conferma l'attacco compare nella sezione come riga compatta con nome, bonus di attacco e danno/tipo, sotto un'intestazione che nomina le tre colonne; annullare lascia l'attacco nello stato precedente.
- [x] Riaprire l'editor di un attacco salvato dall'icona a ingranaggio della sua riga, modificarlo e rimuoverlo dall'editor stesso.
- [x] Bloccare e sbloccare la sezione con il lucchetto per evitare modifiche accidentali durante il gioco: a sezione bloccata restano disponibili lettura e tiro, non aggiunta, modifica e rimozione.
- [x] Usare lo stesso modello per **Strumenti e competenze**: aggiunta e modifica in un editor con nome, livello di competenza, caratteristica associata e bonus aggiuntivo; riga compatta con nome e bonus calcolato; ingranaggio per riaprire l'editor; lucchetto per la sezione.
- [x] Leggere i dadi vita in un riquadro che mostra il totale in alto e i dadi rimasti in basso, con il tipo di dado scelto da una select fra d4, d6, d8, d10 e d12 accanto all'etichetta. Il tipo selezionato determina il dado lanciato in fase B.
- [x] Contare successi e fallimenti dei tiri salvezza contro morte come tre pallini per riga, riempibili e svuotabili anche a mano, al posto dei due campi numerici attuali.

**Master**

- [x] Usare gli stessi editor, indicatori di competenza, riquadri e righe compatte sulla scheda di un Player, con le stesse regole valide per il proprietario.

**Sistema**

- [x] Implementare le regole di calcolo in un modulo condiviso fra server e client, così che la scheda mostrata, i valori proiettati sul token e le formule che la Fase B costruirà sul server usino la stessa fonte e non possano divergere.
- [x] Togliere dal documento della scheda i valori che ora si calcolano — modificatore di caratteristica, bonus di competenza, Percezione passiva, iniziativa, valore dei tiri salvezza, valore delle abilità, CD del tiro salvezza e bonus di attacco da incantatore — conservando come dati soltanto punteggi, livello, competenze dichiarate, caratteristica da incantatore e bonus vari.
- [x] Sostituire la competenza booleana delle abilità con i tre livelli già usati dagli strumenti: nessuna competenza, competente, esperto.
- [x] Trasformare la caratteristica da incantatore da testo libero a caratteristica scelta, riconoscendo nella conversione il testo che ne nomina una. Quando il testo non è riconoscibile la caratteristica resta non scelta e i due valori da incantatore non vengono reinterpretati.
- [x] Estendere il modello dell'attacco in `data_json` con i campi dell'editor, mantenendo l'identificatore di riga e le patch per elemento già usate in P0.4.
- [x] Vincolare `hitDice.type` all'insieme d4, d6, d8, d10, d12 più lo stato «non scelto», e trasformare successi e fallimenti contro morte in contatori interi da 0 a 3, rifiutando sul server i valori fuori dominio.
- [x] Migrare le schede esistenti conservando ogni totale oggi visibile: dai valori scritti a mano il sistema ricava punteggi e competenze e deposita nel bonus vari la differenza che le regole non spiegano, senza perdere dati e senza cambiare un numero sotto gli occhi del giocatore.
- [x] Ricalcolare e proiettare sul token il modificatore di iniziativa quando cambia il punteggio di Destrezza o il suo bonus vari, al posto della proiezione diretta del campo oggi scritto a mano.
- [x] Salvare lo stato del lucchetto come dato della scheda e applicarlo a chi la apre. Il lucchetto protegge dagli errori, non concede permessi: le autorizzazioni restano quelle di P0.4.
- [x] Mantenere per editor, righe, indicatori e riquadri la stessa catena di patch, versione, SSE e persistenza con debounce di P0.4. Aprire l'editor non sospende la sincronizzazione e la conferma non riscrive l'intero documento.

**Stato attuale:** Fase A completata e archiviata come change `p0-5a-sheet-action-editors` (35/36 task; il task 8.2 di doppia verifica manuale Master/proprietario in due finestre resta posticipato). Le regole 5e vivono in `shared/dnd-rules.mjs`, il documento conserva solo gli input, attacchi e strumenti hanno editor dedicato e riga compatta, le sezioni hanno il lucchetto, dadi vita e salvataggi contro morte hanno la nuova resa. Gli ancoraggi `data-roll-source` della tabella della Fase B sono già al loro posto e ora collegati al motore dei tiri (Fase B, anch'essa archiviata).

**Accettazione:** un Player inserisce `16` in Destrezza e legge `+3` come modificatore, nelle abilità basate su Destrezza e nell'iniziativa; porta il livello a `5` e vede il bonus di competenza passare a `3` e propagarsi a tiri salvezza, abilità competenti, strumenti e attacchi competenti. Un doppio click sull'indicatore di Furtività la rende esperta e il valore raddoppia il bonus di competenza; un bonus vari di `1` sulla stessa riga aggiunge esattamente uno al totale. Aggiunge un attacco dall'editor, conferma e lo vede come riga compatta con nome, bonus e danno/tipo; lo riapre dall'ingranaggio, cambia un campo e ritrova il valore aggiornato nella riga e sul client del Master senza refresh. Nella tab Incantesimi sceglie Carisma come caratteristica da incantatore e, con Carisma `16` a livello `5`, legge CD `14` e bonus di attacco `+6`. Una scheda compilata prima della change mostra gli stessi totali di prima, con attacchi e strumenti nel nuovo modello e nessun valore perso. Con il lucchetto chiuso l'aggiunta, la modifica e la rimozione non sono disponibili. Dopo riavvio, punteggi, competenze, bonus vari, campi dell'editor, tipo di dado vita e pallini dei salvataggi contro morte ricompaiono invariati.

#### Fase B — Motore dei tiri

**Bersagli cliccabili e formula di ciascuno.** L'elenco è chiuso: un elemento della scheda non nominato qui non lancia nulla.

| Bersaglio | Formula | Valore usato |
| --- | --- | --- |
| Caratteristiche FOR, DES, COS, INT, SAG, CAR | `1d20 + mod` | il modificatore calcolato dal punteggio, cioè il numero grande della cella |
| Tiri salvezza delle sei caratteristiche | `1d20 + valore` | il valore calcolato della rispettiva riga |
| Abilità, da Acrobazia a Sopravvivenza | `1d20 + valore` | il valore calcolato della rispettiva riga |
| Iniziativa | `1d20 + valore` | il valore calcolato del riquadro Iniziativa |
| Strumenti e competenze | `1d20 + bonus` | il bonus calcolato mostrato nella riga compatta |
| Attacco della sezione Attacchi e incantesimi | tiro di attacco e danno collegati | i campi dell'editor dell'attacco |
| Dadi vita | il dado scelto nella select | il tipo di dado vita del riquadro |
| Tiri salvezza contro morte | `1d20` senza modificatori | nessuno |

**Percezione passiva non è un bersaglio.** Nelle regole una prova passiva non prevede alcun tiro: il valore vale 10 più il valore di Percezione ed è il numero che il Master confronta, per esempio con la Furtività di chi si nasconde. La fase A lo calcola, ma resta un valore di consultazione. L'equivalente attivo è la prova di Percezione, già cliccabile fra le Abilità.

**Iniziativa.** Il tiro usa il valore del riquadro Iniziativa, che la fase A calcola come modificatore di Destrezza più il bonus vari. Un bonus da talento o privilegio si scrive nel bonus vari e finisce nel tiro senza che il motore debba conoscere quel talento. Il collegamento del risultato al tracker arriva con P0.8.

**Incantesimi.** Un incantesimo offensivo si inserisce come attacco nella sezione Attacchi e incantesimi della prima tab e da lì si lancia. La tab Incantesimi resta un elenco di consultazione con stato preparato o conosciuto e slot: le sue righe non sono cliccabili in P0.5.

**Players**

- [x] Tirare con un click i bersagli della tabella, mantenendo disponibile il tiro libero di P0.3.
- [x] Tirare un attacco dalla sua riga compatta ottenendo nel log tiro di attacco e danno collegati, con il secondo blocco di danno e il tiro salvezza quando l'attacco li prevede.
- [x] Tirare un dado vita cliccando l'etichetta del riquadro: il dado lanciato è quello della select e i dadi rimasti calano di uno. A zero rimasti, o con il tipo di dado non ancora scelto, il tiro non parte e l'interfaccia ne spiega il motivo.
- [x] Tirare un salvataggio contro morte cliccando l'etichetta del riquadro: da 1 a 9 si riempie un pallino di fallimento, da 10 a 20 un pallino di successo. Al terzo successo o al terzo fallimento l'esito è segnalato e il tiro si ferma finché i pallini non vengono azzerati.
- [x] Scegliere vantaggio, svantaggio, modificatore temporaneo e visibilità con l'interazione secondaria sull'elemento, senza cambiare il valore salvato nella scheda.
- [x] Leggere nel log della tab Chat + Dadi i tiri generati dalla propria scheda, con personaggio, azione, formula, singoli dadi, modificatori applicati e visibilità.

**Master**

- [x] Leggere i tiri pubblici e segreti dei Player, tirare dalle schede che può modificare e continuare a usare il tiro libero nel contesto della sessione.

**Sistema**

- [x] Usare il calcolo server e le regole di visibilità dei tiri introdotti in P0.3 anche per le azioni della scheda: il client invia l'azione e il contesto, mai il risultato.
- [x] Ricostruire sul server la formula dai campi della scheda al momento del tiro, secondo la tabella dei bersagli, ignorando quella proposta dal client e rifiutando un tiro su una scheda che il richiedente non può leggere.
- [x] Rifiutare in modo comprensibile il tiro di un bersaglio il cui valore non è interpretabile come numero, senza aggiungere una voce al log.
- [x] Collegare ogni tiro al personaggio e all'azione usata, così che il log distingua «Prova di Furtività» da «Attacco — Spada corta».
- [x] Mostrare chiaramente vantaggio, svantaggio, modificatori e dadi tenuti.
- [x] Applicare la soglia di critico dell'attacco: un tiro naturale pari o superiore alla soglia raddoppia i dadi del danno e il log lo dichiara.
- [x] Applicare come patch di scheda i soli effetti collaterali previsti — dadi vita rimasti, successi e fallimenti contro morte — passando dal flusso di P0.4 e quindi dalla sincronizzazione SSE.

**Stato attuale:** completato e archiviato come change `p0-5b-sheet-roll-engine`. Il resolver server-side (`server/character-sheet-roll-resolver.mjs`) ricostruisce la formula di ciascun bersaglio dallo stato live della scheda e riusa il generatore già introdotto in P0.3; l'endpoint `POST /api/battle-map/rolls` accetta `source` in alternativa a `formula`. Ogni bersaglio `1d20` tira due dadi indipendenti, sul modello Roll20, senza modalità scelta dal client; il danno di un attacco è un bersaglio separato dal tiro di attacco, con critico dedotto dal client dall'ultimo tiro di attacco per lo stesso bersaglio. Dadi vita e salvataggi contro morte restano un tiro singolo e passano dalla stessa catena di patch/versione/SSE/persistenza di P0.4. Il dado 3D (P0.6), il collegamento del risultato dell'iniziativa al tracker (P0.8) e il recupero del log dopo un riavvio (P0.11) restano fuori ambito.

**Accettazione:** due player vedono nel log lo stesso attacco pubblico tirato dalla riga compatta, con autore, personaggio, azione, formula e danno corretti; un tiro segreto della scheda è visibile solo all'autore e al Master. Ogni bersaglio della tabella produce con un click un tiro con la formula prevista, senza aprire modali, mentre l'interazione secondaria apre la scelta di vantaggio, svantaggio e visibilità. La Percezione passiva e le righe della tab Incantesimi non producono tiri. Un dado vita lanciato fa calare i rimasti di uno su tutti i client autorizzati; tre fallimenti contro morte fermano ulteriori tiri. Il recupero del log dopo un riavvio è previsto in P0.11.

### P0.6 — Motore dei dadi: correttezza probabilistica e dado 3D

**Perché conta:** il tiro è l'atto centrale del gioco, ma oggi arriva al tavolo come un numero che compare in una riga di log. Manca il momento in cui il dado rotola e si ferma, che in Baldur's Gate 3 e nei VTT moderni è ciò che rende il risultato un evento condiviso invece di un dato. Nello stesso passaggio va messa in ordine la parte che nessuno vede: il generatore del server, le distribuzioni che le regole 5e implicano e i controlli che dimostrano che il dado è onesto.

**Che cosa significa «una formula invece di una funzione random».** Un dado fisico equo non segue una formula alternativa al caso: segue una distribuzione, l'uniforme discreta su `{1, …, S}`, in cui ogni faccia vale esattamente `1/S`. Qualunque formula che si discosti da quella distribuzione produce un dado truccato, non un dado più realistico. La parte matematica di questa feature non sostituisce quindi il caso, ma lo rende dimostrabile e descritto:

1. il generatore deve produrre un'uniforme esatta, non approssimata;
2. ogni tipo di tiro deve avere un modello di probabilità scritto, usato sia per i test sia per ciò che l'interfaccia mostra al giocatore;
3. la correttezza deve essere verificabile da una suite di test statistici, non soltanto affermata.

**Il difetto attuale del generatore.** Il server calcola ogni faccia con `randomBytes(4).readUInt32BE(0) % sides + 1` (`server/index.mjs`, funzione `createAuthoritativeRoll`). L'entropia è buona, ma il modulo su un intervallo che non divide `2^32` introduce il *modulo bias*: per un d20 restano `2^32 mod 20 = 16` valori in eccesso e per un d100 `2^32 mod 100 = 96`, quindi alcune facce diventano leggermente più probabili delle altre. Lo scarto è dell'ordine di `10⁻⁸` e nessun tavolo lo percepirà mai, ma è un errore reale, gratuito da togliere e incompatibile con l'idea di un motore verificabile. Il client, in `src/utils/dice.ts`, usa già il campionamento con rifiuto corretto: le due implementazioni vanno unificate, con il server come unica autorità.

**Modelli di probabilità dei tiri previsti.** Sono la specifica del motore e la base dei test.

| Tiro | Modello | Formule |
| --- | --- | --- |
| `1dS` | uniforme discreta su `{1, …, S}` | `P(X = k) = 1/S`; `E[X] = (S + 1) / 2`; `Var(X) = (S² − 1) / 12` |
| `NdS` | somma di `N` variabili indipendenti | `E = N(S + 1) / 2`; `Var = N(S² − 1) / 12`; distribuzione per convoluzione |
| Vantaggio (`2d20`, si tiene il massimo) | massimo di due uniformi indipendenti | `P(X ≤ k) = k² / 400`; `P(X = k) = (2k − 1) / 400`; `E[X] = 13,825` |
| Svantaggio (`2d20`, si tiene il minimo) | minimo di due uniformi indipendenti | `P(X ≥ k) = (21 − k)² / 400`; `P(X = k) = (41 − 2k) / 400`; `E[X] = 7,175` |
| Prova contro una CD con modificatore `m` | coda superiore dell'uniforme | `p = (21 − (CD − m)) / 20`, limitata fra 0 e 1; con vantaggio `1 − (1 − p)²`, con svantaggio `p²` |
| Critico con soglia `T` | coda superiore sul dado naturale | `P(critico) = (21 − T) / 20` |

**Il dado 3D mostra, non decide.** Il valore resta quello calcolato dal server e trasmesso via SSE; l'animazione riceve il risultato già deciso e viene forzata a fermarsi su quella faccia. La fisica è presentazione: non deve poter cambiare, ritardare o invalidare un risultato, e un'animazione interrotta, saltata o mai partita lascia il log identico.

**Libreria di rendering.** Scrivere da zero mesh, fisica e atterraggio pilotato non è proporzionato al valore aggiunto. La scelta è [`@3d-dice/dice-box-threejs`](https://www.npmjs.com/package/@3d-dice/dice-box-threejs) (MIT, ThreeJS più cannon-es), l'unica delle due varianti mantenute che supporta i risultati predeterminati con la notazione `@`: `Box.roll("1d20@17")` fa rotolare un d20 che si ferma su 17, ed è esattamente il contratto che serve. La variante principale [`@3d-dice/dice-box`](https://github.com/3d-dice/dice-box) (BabylonJS più ammo) è più curata graficamente ma non espone risultati predeterminati, quindi è esclusa. Texture e suoni della libreria vanno copiati a mano nella cartella statica dell'app; il risultato torna da callback, da evento o da `await` sulla `roll()`.

**Karmic dice: fuori dal comportamento predefinito.** Baldur's Gate 3 offre un'opzione che corregge le sequenze sfortunate e che, per costruzione, non è più uniforme. Se il tavolo la vuole, resta una regola della casa dichiarata: interruttore del Master, spento di default, stato visibile ai partecipanti e ogni tiro influenzato marcato nel log. Senza queste condizioni non entra.

**Fuori perimetro:** equità verificabile con impegno e rivelazione del seme (commit-reveal), dadi personalizzati per giocatore, temi acquistabili, sincronizzazione fotogramma per fotogramma dell'animazione fra client.

**Players**

- [ ] Vedere il dado rotolare in 3D sopra la mappa quando si tira, dai controlli del pannello, dal comando `/r` e dai bersagli della scheda di P0.5, e leggere sulla faccia ferma lo stesso valore che compare nel log.
- [ ] Vedere tutti i dadi di una formula con più dadi, ciascuno con il proprio valore, e la somma con i modificatori presentata al termine dell'animazione.
- [ ] Riconoscere a colpo d'occhio vantaggio e svantaggio: entrambi i d20 rotolano, quello tenuto resta in evidenza e quello scartato è visibilmente attenuato.
- [ ] Saltare l'animazione con un click o con `Esc` e ottenere subito il risultato, senza perdere la voce di log.
- [ ] Continuare a usare mappa, pannello e scheda mentre i dadi rotolano: l'animazione non blocca l'interfaccia e non ruba il focus da tastiera.
- [ ] Disattivare l'animazione 3D dalle proprie preferenze e tornare al risultato immediato di oggi; la scelta è personale, resta dopo un riavvio del client e non tocca gli altri partecipanti.
- [ ] Vedere l'animazione dei tiri pubblici degli altri partecipanti, così che il tiro resti un momento condiviso e non un evento privato.

**Master**

- [ ] Vedere l'animazione dei propri tiri e di quelli pubblici, e i tiri segreti dei Player animati secondo le regole di visibilità di P0.3, senza mostrarli agli altri.
- [ ] Accendere e spegnere per la partita l'opzione karmic dice, spenta di default, con lo stato visibile ai partecipanti.

**Sistema**

- [ ] Sostituire il campionamento con modulo del server con un campionamento con rifiuto su CSPRNG, eliminando il modulo bias per ogni faccia supportata, e usare lo stesso modulo condiviso del client al posto delle due implementazioni odierne.
- [ ] Isolare il motore dei tiri in un modulo con una sola porta d'ingresso, così che il tiro libero di P0.3 e i tiri della scheda di P0.5 passino dalla stessa funzione e dallo stesso generatore.
- [ ] Documentare nel modulo i modelli di probabilità della tabella e coprirli con test: valore atteso e varianza entro la tolleranza dichiarata su un campione grande, tutte le facce osservate, test chi-quadro sull'uniformità di d20 e d100, distribuzione di vantaggio e svantaggio confrontata con le formule chiuse.
- [ ] Rendere i test riproducibili iniettando un generatore deterministico nei soli test, lasciando il CSPRNG come unica sorgente in esecuzione reale. Il seme non viene esposto ai client.
- [ ] Trasmettere nella risposta e nello stream SSE i valori dei singoli dadi, quali sono tenuti e quali scartati, così che ogni client autorizzato possa pilotare l'animazione sul risultato già deciso.
- [ ] Rifiutare lato server qualunque risultato proposto dal client: l'animazione è un consumatore del risultato, mai una sua fonte.
- [ ] Montare la scena 3D come sovrapposizione sopra la mappa, trasparente agli eventi del puntatore, creata alla prima occorrenza e sospesa quando nessun tiro è in corso, senza cambiare le coordinate della mappa né la disposizione del pannello.
- [ ] Trattare `prefers-reduced-motion` e assenza di WebGL come casi previsti, non come errori: in entrambi si mostra subito il risultato numerico.
- [ ] Limitare i dadi animati al tetto già applicato dal server alla formula e degradare al risultato immediato se il tetto viene superato o se la scena non si inizializza.
- [ ] Copiare texture e suoni della libreria fra gli asset statici dell'app come passo riproducibile della build, senza dipendere da una CDN esterna in esecuzione.
- [ ] Mantenere l'audio silenzioso finché non c'è un'interazione dell'utente, come richiesto dai browser, e renderlo disattivabile.

**Stato attuale:** i tiri sono calcolati autorevolmente dal server e mostrati come numeri nel log e nell'anteprima dell'ultimo tiro; nessuna rappresentazione fisica del dado esiste. Il server campiona con `% sides`, quindi con un modulo bias residuo, mentre il client usa già il campionamento con rifiuto: le due logiche sono duplicate e divergenti. Non esistono test statistici sul generatore né un modello di probabilità scritto.

**Accettazione:** un Player tira `1d20+5` dai controlli del pannello e vede un d20 rotolare sopra la mappa e fermarsi sul valore che il log riporta, con il totale coerente; lo stesso avviene per un tiro dalla scheda e per `/r 2d6+1`, dove entrambi i d6 mostrano il proprio valore. Con vantaggio, due d20 rotolano e quello tenuto è distinguibile. Un secondo client vede l'animazione del tiro pubblico e non quella di un tiro segreto altrui. Premendo `Esc` l'animazione termina subito e il log resta invariato; disattivando l'animazione nelle preferenze il tiro torna immediato e gli altri partecipanti continuano a vedere la propria. Con `prefers-reduced-motion` attivo o WebGL non disponibile l'app non mostra errori e resta usabile. La suite di test esegue un campione grande per d4, d6, d8, d10, d12, d20 e d100 e verifica media, varianza, copertura di tutte le facce e chi-quadro entro la soglia scelta; vantaggio e svantaggio corrispondono alle formule chiuse; nessuna faccia risulta favorita dal generatore.

### P0.7 — Token del giocatore, movimento e misura

**Players**

- [ ] Selezionare, localizzare e muovere solo i token controllati dal proprio utente, da mouse e tastiera.
- [ ] Aggiungere righello e percorso visibile con distanza in caselle e unità della scena prima di confermare il movimento.
- [ ] Calcolare il costo segmento per segmento, comprese diagonali e cambi di direzione; scegliere esplicitamente la regola per le diagonali della partita.
- [ ] Mostrare portata e sagome di base per cerchio, cono e linea.
- [ ] Permettere un ping sulla mappa, visibile agli altri partecipanti, per indicare un punto senza descriverne le coordinate.

**Master**

- [ ] Posizionare e spostare i token della scena e impostare la regola delle diagonali per la partita.

**Sistema**

- [ ] Validare sul server controllo del token, percorso, ostacoli e budget di movimento del turno.

**Stato attuale:** i player possono muovere i propri token, ma non hanno un righello o un percorso misurato. Il costo usa il massimo tra spostamenti orizzontali e verticali accumulati: tre caselle a destra e poi tre in basso possono costare tre caselle invece di sei.

**Accettazione:** un player misura un percorso spezzato, vede il costo prima del movimento, muove il proprio token e tutti osservano la stessa posizione. Un movimento fuori budget o attraverso un ostacolo viene rifiutato.

### P0.8 — Turni, HP e condizioni durante il combattimento

**Players**

- [ ] Tirare l'iniziativa dalla scheda e vedere il risultato nella propria voce del tracker, scegliendo nella modale fra tiro normale, vantaggio e svantaggio.
- [ ] Mostrare al player quando tocca a lui e quanto movimento o risorse gli restano nel turno.
- [ ] Vedere danni, cure, HP temporanei e condizioni aggiornarsi su scheda e token durante il combattimento.

**Master**

- [ ] Avviare e avanzare il combattimento, correggere iniziativa e turno, applicare danni, cure e condizioni ai bersagli.
- [ ] Inserire un elemento nell'iniziativa in qualunque posizione, assegnando il valore manualmente oppure lanciando un dado dalla modale con scelta fra tiro normale, vantaggio e svantaggio.

**Sistema**

- [ ] Mantenere condivisi iniziativa, turno attivo e numero del round.
- [ ] Collegare l'iniziativa tirata dalla scheda alla voce corretta del tracker.
- [ ] Ordinare per valore decrescente i tiri di iniziativa, conservando l'ordine imposto esplicitamente dal Master quando sposta o inserisce una voce in una posizione specifica.
- [ ] Applicare danni, cure e HP temporanei al bersaglio in pochi passaggi, aggiornando scheda e token insieme.
- [ ] Usare marcatori di condizione specifici, con durata o scadenza quando pertinente.

**Stato attuale:** iniziativa, round, HP e alcune condizioni sono già presenti, ma non sono collegati a una scheda personale e alle sue azioni. La modale esistente non copre lo svantaggio né l'inserimento arbitrario nell'ordine.

**Accettazione:** il Master avvia l'incontro, un Player sceglie normale, vantaggio o svantaggio e tira iniziativa dalla scheda; il tracker colloca il risultato nell'ordine decrescente. Il Master inserisce una voce a scelta manualmente o con un tiro, anche in una posizione diversa da quella suggerita dal valore. Turno, HP, condizioni e risorse restano coerenti su scheda, token e tracker.

### P0.9 — Mappe e scene giocabili

**Players**

- [ ] Vedere la scena attiva, i suoi disegni e gli elementi predefiniti aggiornarsi in tempo reale, senza poter modificare la mappa salvo un permesso esplicito del master.

**Master**

- [ ] Caricare immagini di mappa senza modificare il codice.
- [ ] Creare una scena vuota da disegnare, oppure usare un'immagine importata come base.
- [ ] Disegnare liberamente sulla mappa con matita e gomma; scegliere colore e spessore, annullare e ripetere le modifiche.
- [ ] Inserire elementi predefiniti come rocce e alberi; spostarli, ridimensionarli, ruotarli ed eliminarli. Permettere di decidere separatamente se bloccano movimento e visuale.
- [ ] Creare, rinominare e selezionare più scene.
- [ ] Impostare per ogni scena dimensioni, scala, griglia e unità di misura.
- [ ] Allineare la griglia a un'immagine importata, con anteprima prima del salvataggio.
- [ ] Spostare il party alla scena attiva senza perdere lo stato delle altre.

**Sistema**

- [ ] Tenere separati sfondo, tratti disegnati, elementi predefiniti, token e blocchi di movimento/visuale, così da poterli modificare e sincronizzare senza effetti collaterali.
- [ ] Salvare disegni, elementi predefiniti, token, elementi nascosti e stato di esplorazione per ciascuna scena.

**Stato attuale:** la board usa un'immagine di sfondo fissata nel CSS. La modalità `obstacle-paint` colora celle per creare ostacoli, ma non permette disegni liberi o di collocare elementi grafici come rocce e alberi. Non c'è un flusso di importazione e gestione delle scene.

**Accettazione:** il master crea una scena vuota, disegna un sentiero con la matita, inserisce un albero e una roccia, li modifica e vede gli aggiornamenti sui client dei player. Importa poi una seconda mappa con scala diversa, passa fra le due scene e ritrova disegni, elementi e token come li ha lasciati anche dopo un riavvio.

### P0.10 — Preparazione dell'incontro e segreti

**Master**

- [ ] Permettere al master di predisporre nemici ed elementi nascosti e rivelarli quando serve.
- [ ] Aggiungere una maschera manuale per coprire o rivelare aree della mappa durante l'esplorazione.
- [ ] Verificare la vista del player da un'anteprima master.

**Players**

- [ ] Vedere solo aree, token ed elementi rivelati dal master, con aggiornamento simultaneo alla rivelazione.

**Sistema**

- [ ] Escludere dalle risposte HTTP e SSE dati e posizioni degli elementi che il player non deve ancora conoscere.

**Stato attuale:** il server filtra i token marcati `isInvisible`, mentre la visione per distanza e ostacoli è calcolata nel client. Un elemento fuori visuale può quindi essere presente nei dati ricevuti dal player. Non c'è una maschera manuale di esplorazione.

**Accettazione:** il master prepara un'imboscata, i player non ricevono i dati dei nemici nascosti e la rivelazione manuale li mostra a tutti nello stesso momento.

### P0.11 — Persistenza e recupero della partita

**Players**

- [ ] Ritrovare posizione, risorse e log dei tiri dopo una riconnessione o un riavvio del server, insieme alla scheda già salvata in P0.4.

**Master**

- [ ] Recuperare almeno una versione precedente della partita ed esportare o importare una sessione completa, comprese scene e asset.

**Sistema**

- [ ] Spostare lo stato live di scene, token, combattimento e log dei tiri dalle sole variabili in memoria al database SQLite creato in P0.1.
- [ ] Salvare automaticamente le modifiche importanti senza richiedere “sospendi”.
- [ ] Ripristinare lo stato più recente all'avvio del server.
- [ ] Salvare in transazioni le modifiche correlate e segnalare gli errori di scrittura.
- [ ] Rendere persistenti le sessioni di login o prevederne il rinnovo senza perdita dello stato della partita.
- [ ] Prevedere una migrazione una tantum dell'eventuale `last-session.json` esistente, senza sovrascrivere dati già presenti nel database.

**Stato attuale:** stato condiviso, sessioni di login e undo vivono in memoria. Lo snapshot JSON viene scritto solo manualmente in `server/data/last-session.json`; all'avvio il server ne carica i metadati, ma non ripristina automaticamente la partita. Il database SQLite di P0.1 è presente, ma non conserva ancora lo stato live.

**Accettazione:** dopo movimenti, modifiche ai token e passaggio di scena, il riavvio del server riporta tutti i client allo stesso stato senza intervento del master.

## P1 — profondità delle regole e dell'esplorazione

### P1.1 — Level up guidato e automatizzato

**Players**

- [ ] Mostrare solo le opzioni disponibili al livello successivo: privilegi, incremento caratteristiche o talenti, competenze, incantesimi e risorse.
- [ ] Vedere un'anteprima delle modifiche prima della conferma e poter correggere manualmente la scheda dopo l'applicazione.
- [ ] Mantenere modificabili tutti i valori della scheda: l'automazione propone e calcola, ma non blocca homebrew o decisioni del tavolo.

**Master**

- [ ] Scegliere per la campagna se il level up richiede approvazione e poter approvare o correggere le scelte del player.

**Sistema**

- [ ] Definire l'edizione delle regole per ogni personaggio (D&D 5e 2014 o 2024) ed evitare di mescolare progressioni incompatibili.
- [ ] Usare la scheda corrente come base: classe, eventuali classi multiple, sottoclasse, livello, caratteristiche, competenze, incantesimi e scelte precedenti.
- [ ] Calcolare i valori derivati pertinenti, come bonus di competenza, HP, slot e usi delle capacità, rispettando le scelte del giocatore e le regole selezionate.
- [ ] Applicare il nuovo livello in modo atomico, conservando la versione precedente della scheda.
- [ ] Verificare l'integrazione con 5e.tools: identificare dataset e versioni utilizzabili, formato dei dati, aggiornamenti e condizioni di riuso prima di scegliere endpoint o importazione locale.
- [ ] Usare il flusso “Level Up” di Plutonium per Foundry come riferimento funzionale: riconoscimento della classe esistente, selezione delle opzioni e applicazione dei nuovi privilegi alla scheda. Verificarne limiti e compatibilità con le regole 2014/2024.

**Dipendenza tecnica:** non è stata confermata una REST API pubblica e stabile di 5e.tools. Il [repository 5e.tools](https://github.com/5etools-mirror-3/5etools-src/blob/main/README.md) pubblica dati JSON; la loro utilizzabilità come fonte per questa funzione va verificata insieme alle condizioni dei contenuti, oltre alla licenza del codice. [Plutonium](https://5e.tools/plutonium.html) è un modulo per Foundry VTT, non un'API pronta da collegare a questa applicazione. Il suo [changelog](https://github.com/TheGiddyLimit/plutonium-next/blob/master/changelog.json) documenta un pulsante “Level Up” per schede compatibili.

**Accettazione:** un personaggio passa dal livello 3 al 4; il player vede le scelte consentite e un confronto prima/dopo, conferma, ritrova la scheda aggiornata dopo il riavvio e può correggere manualmente un valore senza perdere il resto.

### P1.2 — Visione dinamica e ambienti complessi

**Players**

- [ ] Vedere la mappa dalla propria prospettiva, distinguendo area attualmente visibile, già esplorata e mai scoperta.

**Master**

- [ ] Modellare muri, porte e finestre con regole distinte per vista e movimento.
- [ ] Definire se i personaggi condividono la visuale del party o vedono solo dalla propria posizione.

**Sistema**

- [ ] Calcolare sul server la visuale per player in base a posizione, portata, ostacoli e fonti di luce.
- [ ] Rendere coerenti illuminazione e visibilità dei token per tutti i client.

**Stato attuale:** esistono luci, ostacoli e visione client-side, ma il server non applica una visuale dinamica individuale allo stato inviato ai player.

**Accettazione:** un player non riceve i dati di un nemico oltre un muro; aprire una porta aggiorna visuale e movimento senza un intervento manuale del master.

### P1.3 — Destinatari personalizzati per i tiri

**Players**

- [ ] Condividere un tiro con uno o più destinatari scelti, oltre alle opzioni pubblico e segreto di P0.3.

**Master**

- [ ] Effettuare tiri riservati per uno o più player selezionati.

**Sistema**

- [ ] Limitare consegna, lettura e persistenza dei tiri ai destinatari previsti, mantenendo separata la cronologia pubblica.

**Accettazione:** un tiro indirizzato a un player specifico compare solo all'autore, al Master e al destinatario previsto e resta privato anche dopo riconnessione o ripristino della sessione.

## P2 — utilità di sessione

**Players**

- [ ] **P2.1** — Consultare handout condivisi dal master secondo i permessi assegnati.
- [ ] **P2.5** — Vedere lo stato della propria connessione e un segnale chiaro di riconnessione.
- [ ] **P2.6** — Inviare e leggere messaggi nella chat testuale in tempo reale della tab Chat + Dadi, sopra i controlli dei dadi già collocati in basso nel pannello; poter inviare un messaggio privato al Master o a un destinatario selezionato.

**Master**

- [ ] **P2.1** — Creare handout e assegnare i permessi di visualizzazione.
- [ ] **P2.2** — Gestire una libreria di immagini e token riutilizzabili fra scene.
- [ ] **P2.3** — Gestire livelli avanzati per sfondo, token, annotazioni riservate e ostacoli.
- [ ] **P2.4** — Duplicare, archiviare e cercare le scene.
- [ ] **P2.5** — Vedere presenza e stato di connessione dei player.
- [ ] **P2.6** — Scrivere nella chat pubblica o inviare messaggi privati a uno o più player.

**Sistema**

- [ ] **P2.3** — Applicare visibilità e permessi ai livelli avanzati, mantenendo separati i dati riservati del master.
- [ ] **P2.6** — Distribuire i messaggi in tempo reale solo ai destinatari autorizzati, verificarne i permessi sul server e conservarne la cronologia pubblica e privata dopo riconnessione o riavvio.

## Prova del core loop P0

Dopo `npm run db:migrate`, con master e almeno due player collegati da browser distinti:

1. Master e player accedono con i profili del roster tramite il nuovo login e usano la mappa e le quattro tab del pannello destro. Un Player apre la propria scheda Roll20, compila le tre tab e sostituisce il ritratto; il Master vede e corregge gli aggiornamenti live, mentre i dati mappati sono collegati al token.
2. Il master crea una scena vuota, disegna con la matita e colloca una roccia e un albero. I player vedono gli aggiornamenti ma non modificano la mappa. Il master importa anche una seconda mappa, ne calibra la griglia, prepara nemici nascosti e porta il party nella scena.
3. Un player tira un dado dai controlli in basso nel pannello e con `/r 1d20+5`, poi tira un attacco dalla scheda: il dado rotola in 3D sopra la mappa e si ferma sul valore che il log riporta; tutti vedono i risultati pubblici generati dal server. Un tiro segreto resta visibile solo all'autore e al Master.
4. Il player misura un percorso, fa ping sulla mappa e muove il proprio token: distanza, budget e posizione sincronizzata sono corretti.
5. Il Master rivela i nemici e avvia il combattimento; un Player sceglie il tipo di tiro di iniziativa dalla scheda, il Master può inserire una voce in qualsiasi posizione e le modali «Sei il prossimo!»/«Tocca a te!» seguono il turno. Iniziativa, HP e condizioni restano coerenti per tutti. Prima della rivelazione, i player non ricevono i dati dei nemici nascosti.
6. Il server viene riavviato: schede, scene, disegni, elementi predefiniti, posizioni, turni e log dei tiri tornano allo stato salvato automaticamente.

Il core loop è pronto solo quando questa prova riesce senza interventi manuali sui file o sul database.

Per completare P1, il player esegue anche un level up guidato, la visuale cambia automaticamente quando attraversa una porta e i tiri con destinatari personalizzati restano visibili solo ai partecipanti previsti. La chat testuale in tempo reale è prevista in P2.6.
