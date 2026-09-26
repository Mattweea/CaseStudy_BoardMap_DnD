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

**Perché conta:** muovere un token è, dopo il tiro di dado, il gesto più frequente del combattimento, ed è quello su cui il tavolo discute di più. Oggi il movimento parte e arriva senza che nessuno veda quanto costa, e il costo che il server calcola non è quello che le regole 5e prevedono: tre caselle a destra seguite da tre in basso vengono contate come tre, non come sei. La feature rende il costo visibile prima della conferma e corretto dopo di essa.

**Il difetto attuale del conteggio.** Il server accumula separatamente lo spostamento orizzontale e quello verticale del turno e spende il massimo dei due (`movementUsedFromAxisUsage` in `server/index.mjs`), mentre `gridDistance` misura una singola mossa come `max(|dx|, |dy|)`. Su una mossa diagonale pulita le due formule coincidono con la regola PHB, ma su un percorso spezzato il massimo per asse regala movimento: un personaggio con 6 caselle di velocità può percorrerne 12 a forma di L pagandone 6. Il conteggio per asse va sostituito da un costo per segmento, sommato lungo il percorso effettivamente compiuto.

**Decisioni confermate:**

- **Regola delle diagonali:** due opzioni scelte dal Master per la partita — **standard PHB**, dove ogni passo diagonale costa una casella, e **variante DMG 5-10-5**, dove i passi diagonali costano alternativamente una e due caselle. Il contatore dell'alternanza è per turno e per token, si azzera quando il turno ricomincia e non attraversa i round. La distanza euclidea resta fuori.
- **Righello:** uno strumento di misura indipendente, che non muove nulla e che qualunque partecipante può usare su qualunque punto della mappa, **più** la misura mostrata durante il trascinamento di un token che si ha il diritto di muovere. Le due interazioni condividono lo stesso calcolo del costo e la stessa resa grafica del percorso; il trascinamento aggiunge la conferma del movimento.
- **Sagome:** cerchio, cono e linea sono **effimere e condivise**. Mentre un partecipante le disegna, gli altri le vedono comparire in tempo reale via SSE; al rilascio o con `Esc` scompaiono per tutti. Non sono entità della scena, non hanno persistenza né CRUD: quel modello appartiene a P0.9.
- **Ping:** effimero e visibile a tutti, senza alcun controllo sulla visuale altrui. Nessun partecipante, Master compreso, può spostare la camera di un altro.
- **Validazione:** il client invia i waypoint del percorso e il server ricalcola tutto — costo segmento per segmento con la regola della partita, ostacoli su ogni segmento, budget residuo del turno. Il costo proposto dal client non viene mai creduto.
- **Niente pathfinding:** il server non propone rotte che aggirano gli ostacoli. Il percorso lo sceglie chi muove, con i waypoint.

**Unità di misura e confine con P0.9.** La scena come entità non esiste ancora: oggi la mappa è uno sfondo fissato nel CSS e non ha dimensioni, scala né unità dichiarate. P0.7 introduce quindi nello stato condiviso della partita, non in una scena, due sole impostazioni del Master: la regola delle diagonali e l'unità di misura, cioè l'etichetta (`m` o `ft`) e quanto vale una casella (`1,5` e `5` i valori tipici). P0.9, quando creerà le scene, sposterà queste impostazioni al livello della scena senza cambiarne il significato.

**Confine con P0.8.** P0.7 non tocca iniziativa, turno attivo e round: li legge per sapere di chi è il turno e quanto budget resta, esattamente come fa oggi. Reazioni, movimento diviso attorno a un'azione, terreno difficile e movimento verticale restano fuori.

**Players**

- [x] Selezionare e muovere soltanto i token controllati dal proprio utente, da mouse e da tastiera, mantenendo le interazioni già disponibili.
- [x] Localizzare un proprio token con un comando esplicito che centra la visuale su di esso, senza spostare la visuale di nessun altro. Già disponibile come pulsante «Localizza» nelle tab Personaggi e Turni; P0.7 lo conserva e non introduce alcun modo di spostare la visuale altrui.
- [x] Misurare una distanza con lo strumento righello in qualsiasi momento, anche fuori dal proprio turno e senza muovere alcun token: il percorso appare con il costo in caselle e nell'unità della partita.
- [x] Aggiungere waypoint al righello per misurare un percorso spezzato, vedendo il costo di ogni tratto e il totale aggiornarsi a ogni movimento del puntatore.
- [x] Vedere, mentre pianifica lo spostamento di un proprio token, lo stesso percorso misurato con il costo e il budget residuo del turno, e riconoscere prima di confermare se la destinazione è fuori budget, oltre un ostacolo o occupata.
- [x] Confermare il movimento con `Spazio` e annullarlo con `Esc` senza che il token si sposti.
- [x] Mostrare una sagoma di cerchio, cono o linea con origine e orientamento scelti sulla mappa, leggendo la sua misura nell'unità della partita; la sagoma è visibile agli altri partecipanti mentre viene disegnata e scompare al rilascio.
- [x] Lasciare un ping sulla mappa, visibile a tutti i partecipanti per pochi secondi e riconducibile al suo autore, per indicare un punto senza descriverne le coordinate.

**Master**

- [x] Posizionare e spostare qualunque token, continuando a non essere soggetto a budget e ostacoli, e vedere comunque la misura del percorso durante la pianificazione.
- [x] Scegliere per la partita la regola delle diagonali fra standard PHB e variante 5-10-5, e l'unità di misura con il valore di una casella; la scelta è visibile ai partecipanti e si applica subito a righello, sagome e validazione.
- [x] Usare righello, sagome e ping con le stesse interazioni dei Player.

**Sistema**

- [x] Sostituire il conteggio per asse con un costo di percorso: ogni segmento è una sequenza di passi ortogonali e diagonali, il costo è la loro somma secondo la regola scelta, e il totale del turno è la somma dei percorsi compiuti. Il risultato coincide con quello di prima sui percorsi in linea retta o interamente diagonali, e lo corregge sui percorsi spezzati.
- [x] Implementare il costo del percorso in un modulo condiviso fra client e server (`shared/grid-movement.mjs`), così che la misura mostrata prima della conferma e quella addebitata dopo non possano divergere.
- [x] Accettare dal client i waypoint di un movimento e ricalcolare sul server costo, ostacoli su ogni segmento, sovrapposizione con altre creature e budget residuo; rifiutare con un motivo comprensibile e non applicare alcuno spostamento parziale.
- [x] Mantenere il contatore dell'alternanza 5-10-5 come stato di turno del token, azzerarlo agli stessi punti in cui si azzera il movimento usato e includerlo nello stato distribuito via SSE.
- [x] Conservare nello stato condiviso della partita la regola delle diagonali e l'unità di misura, consentirne la modifica al solo Master e distribuirle a tutti i client.
- [x] Distribuire via SSE le sagome in corso di disegno e i ping come eventi effimeri, senza scriverli nello stato persistente e senza che un client disconnesso li ritrovi alla riconnessione.
- [x] Verificare sul server l'autore di ping e sagome come utente autenticato, e applicare alle sagome le stesse regole di visibilità dei token: una sagoma non rivela informazioni che il destinatario non potrebbe già vedere.
- [x] Mantenere l'annullamento per utente già in uso per il movimento degli adventurer, adattandolo al nuovo costo di percorso senza permettere di annullare l'azione di un altro.

**Stato attuale:** completato e archiviato come change `p0-7-token-movement-and-measurement`. Il costo del movimento è un percorso per segmenti calcolato da `shared/grid-movement.mjs` sia lato client sia lato server, con regola delle diagonali (standard o 5-10-5, alternanza per turno e per token) e unità di misura come impostazioni di partita riservate al Master. Un'unica modalità di pianificazione, identica per Master e Player: cliccare un token che si può muovere lo seleziona e apre subito il percorso, che resta fermo al punto di partenza; ogni click successivo (sinistro o destro) aggiunge un waypoint, `Backspace` toglie l'ultimo, `Spazio` conferma verso la casella sotto il puntatore ed `Esc` annulla senza inviare nulla. Una riga di suggerimento sopra la toolbar descrive a parole i gesti disponibili e fa da regione live per gli avvisi di percorso bloccato, budget insufficiente o destinazione occupata. Il server ignora qualunque costo dichiarato dal client, ricalcola tutto sull'intero percorso e, se rifiuta, il motivo raggiunge il richiedente come avviso a schermo (`MovementNotice`, ruolo `alert`), non solo la console. Un movimento accettato — del Master compreso, anche per un solo token — è trasmesso via evento SSE `token-walk` a ogni client connesso, che lo anima alla stessa andatura mentre il binario resta visibile fino a fine corsa; l'animazione parte solo dall'evento, mai in anticipo, così un rifiuto non sembra un movimento che torna indietro. Il righello resta uno strumento separato e indipendente dal turno. Sagome (cerchio, cono, linea) e ping sono eventi SSE effimeri filtrati con la stessa visibilità dei token, mai scritti nello stato condiviso. Gli strumenti di mappa hanno pulsanti in barra e scorciatoie da tastiera (`R` `P` `C` `O` `L`), inerti durante la digitazione e mentre un'interazione è in corso.

**Accettazione:** con la regola standard, un Player misura col righello un percorso di tre caselle a destra e tre in basso e legge `6` caselle con l'unità della partita; passando alla variante 5-10-5, un percorso di tre passi diagonali passa da `3` a `4`. Pianificando lo stesso percorso sul proprio token si vede lo stesso costo e il budget residuo, e a conferma con `Spazio` il server addebita esattamente quel costo mentre il token cammina animato fino alla destinazione; `Esc` lascia il token dov'era senza inviare nulla. Un movimento che supera il budget o attraversa un ostacolo viene rifiutato con il motivo, senza spostamento parziale, anche se il client dichiara un costo inferiore, e il rifiuto compare come avviso sullo schermo di chi ha tentato la mossa. Un secondo client vede il cono disegnato dal Master mentre lo disegna e lo vede sparire al rilascio, e vede la stessa camminata animata quando un Player conferma un movimento; vede il ping per pochi secondi e non subisce alcuno spostamento della propria visuale. Dopo un riavvio del server non resta traccia di sagome e ping, mentre regola delle diagonali e unità restano quelle scelte dal Master finché la partita è in memoria: la loro persistenza segue P0.11.

### P0.7.5 — Dadi misti in un tiro solo, tray cumulativa e icone

**Perché conta:** in 5e i danni misti sono ordinari, non un caso limite. Attacco furtivo `1d8 + 3d6`, Divine Smite `1d8 + 2d8`, Hex che aggiunge `1d6` al danno dell'arma, armi elementali: tutti tiri singoli con tipi di dado diversi. Oggi richiedono due tiri separati, che spezzano il log, la presentazione 3D e la lettura del totale.

**Il limite attuale.** Il server accetta un solo gruppo `NdS` per tiro: `parseRollFormula` in `server/authoritative-roll.mjs` ancora la formula a `^(\d{1,2})d(4|6|8|10|12|20|100)([+-]\d{1,4})?$`. Il vincolo è autorevole, non cosmetico: nemmeno `/r 1d8+1d6` passa. La tray del pannello lo rispecchia azzerando la selezione quando si cambia tipo di dado.

**Il motore è già quasi pronto, ma non del tutto.** `resolveDiceRoll` in `shared/dice-engine.mjs` accetta già un array di `groups` e la presentazione 3D copre già lo scenario "Danno con più gruppi". Ma l'aggregazione è parziale: `formula`, `rolls`, `keptRolls`, `modifier` e `total` sono copiati dal solo primo gruppo. Il tiro di danno della scheda convive con questo limite pubblicando un array `parts` sul log; il tiro libero non ha una via equivalente. E `normalizeGroup` pretende `count >= 1` senza conoscere il segno del gruppo, quindi sottrarre un gruppo richiede un concetto nuovo nel motore.

**Decisioni confermate:**

- **Grammatica della formula:** somma di termini separati da `+` o `-`, dove ogni termine è un gruppo `NdS` o un intero; spazi ignorati ovunque. `1d8 + 3d6`, `2d6+1d8-2` e `1d8 - 1d4` diventano validi.
- **Il `d20` si tira da solo.** Una formula che contiene un `d20` non può contenere altri gruppi di dado: `1d20+5 + 6d4` viene rifiutato. Il motivo è sotto, nella gestione del `d20`. Attacco e danno restano due tiri distinti anche dal tray, come già sono dalla scheda. Niente parentesi, moltiplicazioni, `kh`/`kl`, tiri annidati o dadi esplosivi: quello sarebbe un linguaggio di formule, non questa feature.
- **Gruppo sottratto:** un termine `NdS` preceduto da `-` sottrae il proprio subtotale, ma i singoli dadi del log conservano il valore della faccia e non diventano mai negativi.
- **Il `d20` non ha più una modalità scelta prima del tiro.** Un `1d20` genera sempre due esiti indipendenti e chi legge sceglie quale contare, esattamente come già fanno i bersagli della scheda. Il selettore Normale/Vantaggio/Svantaggio sparisce dalla modale: non resta niente da scegliere prima. `Xd20` con `X` maggiore di uno è ammesso e produce altrettanti esiti indipendenti, senza semantica di coppia.
- **Coppia e indipendenti restano senza marcatore.** `1d20` e `2d20` mostrano entrambi due totali con significati opposti: nel primo caso sono alternative fra cui scegliere, nel secondo due risultati che valgono entrambi. Il dato per distinguerli esiste nel modello (`unresolved` contro `normal`), ma la card non lo rende con un'etichetta: la formula visibile (`1d20` contro `2d20`) e la convenzione già nota al giocatore bastano, e un marcatore in più sarebbe rumore, non chiarezza — deciso con l'utente dopo la prima implementazione.
- **Eccezione confermata:** i salvataggi contro morte restano un tiro singolo, come già impone `character-sheet-roll-actions`, perché in 5e non hanno nozione di vantaggio o svantaggio.
- **`disposition: 'discarded'` smette di esistere fra i tiri nuovi.** Un dado scartato nasce solo quando il server risolve vantaggio o svantaggio, e quella risoluzione richiede che il client dichiari una modalità. Tolto il selettore, nessun tiro nuovo lo produce. Il tiro d'iniziativa non lo produce nemmeno oggi: calcola un valore lato client senza creare una voce di log. Il requisito di `dice-3d-presentation` che chiede di attenuare i dadi scartati viene quindi **rimosso**, non lasciato vero per i soli log storici: una specifica che descrive un comportamento non più generabile inganna chi la legge. Le voci storiche restano leggibili con i dadi alla pari, e il campo `disposition` resta nel dato, quindi la distinzione è ripristinabile in futuro senza migrazione.
- **`initiativeMode` sui token diventa vestigiale.** Il tiro d'iniziativa diventerà doppio come ogni altro `d20`, ma il lavoro appartiene a P0.8: `initiative-presentation` ci assegna già la scelta vantaggio/svantaggio per l'iniziativa, e un valore d'iniziativa deve collassare a un numero solo per guidare l'ordine dei turni — cosa che un `d20` nel log non deve fare.
- **Tiri segreti raggiungibili da ogni superficie.** La scheda guadagna un interruttore in alto, accanto ai comandi di salvataggio, valido per i tiri fatti da lì; il tray guadagna `/rs` con la stessa grammatica di `/r` e conserva i pulsanti nella modale. Oggi `character-sheet-roll-actions` **richiede** il tiro segreto dalla scheda, ma nessun componente invia quel campo: è un requisito dichiarato e mai soddisfatto, non una funzione nuova.
- **L'interruttore della scheda persiste** fra le ricariche, con ambito la singola scheda e memorizzazione locale al browser, come le preferenze di presentazione dei dadi. Non entra nello stato condiviso: è una preferenza di chi tira, non un fatto della sessione.
- **Uno stato di visibilità appiccicoso va mostrato dove si tira.** Il rischio è asimmetrico: tirare segreto credendosi pubblici è un fastidio, tirare pubblico credendosi segreti rivela qualcosa che non si può più ritirare.
- **Limiti aggregati, non per gruppo:** tetto sul numero complessivo di dadi, sul numero di gruppi e sul valore assoluto del modificatore complessivo. Venti gruppi da venti dadi passerebbero ogni controllo locale e produrrebbero quattrocento dadi, ben oltre `MAX_PRESENTATION_DICE`.
- **Contratto del log:** un tiro libero multi-gruppo riusa `parts`, la forma già prodotta dal resolver della scheda e già consumata da `DiceLogEntry`, invece di introdurre una struttura parallela. Un tiro a gruppo singolo continua a non produrre `parts`.
- **Icone:** set poliedrico di game-icons.net, licenza CC BY 3.0, SVG inlineati come gli attuali. Un set "ufficiale" D&D non esiste come asset licenziabile: il marchio è WotC e non distribuisce icone. La licenza impone attribuzione visibile, che entra nel prodotto insieme alle icone e mai dopo. Il `d100` non esiste nel set e resta composto.

**Due modi per leggere lo stesso dato.** Oggi il dettaglio dei dadi si raggiunge diversamente a seconda dell'origine del tiro: dal tray si clicca il totale e la card si espande; dalla scheda si passa il mouse sul totale e compare un tooltip nativo. Le due card non si somigliano nemmeno — quella della scheda non mostra la formula, per una scelta scritta nel codice («mai la formula in chiaro» sopra `PairCard`). Il change le unifica sulla forma del tiro libero: dettaglio al click ovunque, formula sempre visibile ma con peso tipografico inferiore al totale, che resta l'elemento dominante. Un tiro dalla scheda aggiunge soltanto l'azione d'origine, per esempio «Danno — Spada corta».

Il tooltip non è una perdita: non è raggiungibile da tastiera e non è annunciato in modo affidabile, quindi il dettaglio di un tiro dalla scheda è oggi di fatto indisponibile a chi non usa il mouse. Sostituirlo con un comando che espande la card rende quel dato accessibile per la prima volta.

**I tiri con più risultati.** Un bersaglio `1d20` della scheda produce due risultati per requisito, e il server evita apposta di scegliere quale vale. La card unificata espone quindi un comando per ciascun totale e un solo dettaglio che li comprende tutti, invece di eleggerne uno a principale o di spezzare la coppia in due card.

**Deriva sanata.** Il pannello destro espone cinque tab dal commit `029d6ca`, mentre `session-workspace` ne dichiarava quattro. Il requisito viene aggiornato per nominare la tab Impostazioni, che ospita le preferenze di presentazione dei dadi e l'attribuzione delle icone, e per imporre che le tab restino su una sola riga riducendo l'ingombro dei pulsanti invece di andare a capo.

- [x] Sostituire la regex monolitica di `parseRollFormula` con una scansione di termini firmati, così che l'errore possa indicare quale termine o quale limite è stato violato invece di dire soltanto che la formula non va bene.
- [x] Esporre dal motore un totale aggregato che somma i gruppi rispettandone il segno, lasciando invariati i campi legacy che descrivono il primo gruppo, perché `character-sheet-roll-resolver` ne dipende per dedurre il critico.
- [x] Aggiungere il segno esplicito al gruppo normalizzato, mantenendo `count >= 1` per non sfondare le invarianti che contano i dadi.
- [x] Rendere cumulativa la selezione nella tray, rimuovendo l'azzeramento introdotto in `c936485` insieme alla sua causa, e comporre la formula dai contatori.
- [x] Popolare `parts` sul log del tiro libero quando i gruppi sono più di uno, e distinguere nel log il ramo con `parts` da quello a dado singolo, che oggi deduce un unico tipo di dado dalla formula.
- [x] Fissare i tetti complessivi in rapporto esplicito a `MAX_PRESENTATION_DICE`, verificando il degrado al log numerico oltre quel punto.
- [x] Sostituire i tracciati di `DiceIcons.tsx` con il set scelto, adeguando peso e contrasto sul tema scuro, ed esporre l'attribuzione nella tab Impostazioni.
- [x] Far convergere i quattro rami di rendering di `DiceLogEntry` su una card sola, sostituendo il tooltip `title` di `PairCard` con l'espansione al click e mostrando la formula su ogni voce.
- [x] Esporre un comando per ciascun totale nelle voci con più risultati, con un dettaglio unico condiviso, senza eleggere un risultato principale.
- [x] Far prendere al dettaglio le icone dallo stesso componente `DiceGlyph` usato dalla tray, così che la coerenza sia strutturale e non da mantenere a mano.
- [x] Ridurre l'ingombro dei pulsanti delle tab perché le cinque voci stiano su una riga sola alla larghezza nominale del pannello.
- [x] Rimuovere il selettore di modalità dalla modale del tray e risolvere un solo `d20` come `unresolved`, rifiutando una modalità dichiarata dal client.
- [x] Rifiutare il `d20` nelle formule miste con un errore che spieghi il perché, non con un generico "formula non valida".
- [x] Contare nel tetto aggregato i dadi **generati** e non quelli scritti in formula, dato che un `1d20` ne produce due.
- [x] Aggiungere l'interruttore di visibilità in testa alla scheda, propagare `visibility` dalle chiamate di tiro che oggi non lo inviano mai, e indicare lo stato segreto sul bersaglio del tiro.
- [x] Riconoscere `/rs` nella textarea dei comandi.
- [x] Comporre la formula mostrata nella card da tutte le parti: per un danno a più blocchi `log.formula` contiene solo il primo.
- [x] Rimuovere la resa differenziata fra dadi tenuti e scartati dalla presentazione 3D, conservando il campo `disposition` nel dato.

**Stato attuale:** completato e archiviato come change `p0-7-5-mixed-dice-and-icons`. Il tiro libero accetta una somma di gruppi `NdS` firmati e modificatori (`server/authoritative-roll.mjs`), con un tetto complessivo su dadi generati, gruppi e modificatore; un `d20` non può condividere la formula con altri gruppi e si risolve sempre come coppia indipendente (`unresolved`) senza modalità dichiarabile dal client, che è stata rimossa anche dalla modale del tray. `shared/dice-engine.mjs` espone `aggregateTotal` accanto ai campi legacy, che restano il primo gruppo per compatibilità col resolver della scheda. La tray accumula più tipi di dado invece di azzerarli, il comando riconosce anche `/rs`, e la scheda ha un interruttore di visibilità persistente per scheda con lo stato segreto visibile mentre si scorre verso il bersaglio del tiro. `DiceLogEntry` converge su una card sola con formula sempre visibile, dettaglio condiviso che si apre al click su qualunque totale (tastiera compresa) e nessuna didascalia duplicata per il tiro libero; la coppia di un `1d20` e gli esiti indipendenti di un `2d20` restano volutamente senza marcatore, dato che la formula stessa basta a chi legge. La resa differenziata fra dadi tenuti e scartati è sparita dalla presentazione 3D, con `disposition` conservato nel dato. Le icone `d4`/`d8`/`d10`/`d12`/`d20`/`d100` vengono dal set poliedrico di game-icons.net (Skoll e Delapouite, CC BY 3.0, attribuzione nella tab Impostazioni); `d6` resta l'unico senza numerale in faccia, perché l'asset del set non ne porta uno.

**Accettazione:** un Player invia `/r 1d8 + 3d6` e ottiene un tiro solo, con i singoli esiti di entrambi i gruppi nel log e un totale che li comprende; le tre scritture `1d8+2 + 3d6`, `1d8 + 2 + 3d6` e `1d8+2+3d6` producono la stessa formula normalizzata, mentre `/r 1d20+5 + 6d4` viene rifiutato con un errore che spiega che il `d20` si tira da solo. Un `1d20+5` mostra due totali indipendenti con lo stesso modificatore, un `2d20` ne mostra due con lo stesso aspetto: nessuno dei due porta un marcatore, perché la formula stessa distingue i due casi. La modale del tray non offre più alcuna scelta di modalità, e un tiro con `mode` dichiarato dal client viene rifiutato. Un tiro dalla scheda con l'interruttore su segreto non raggiunge gli altri Player, e `/rs 1d8+3` fa lo stesso dal tray. Dalla tray si sceglie un `d8` e tre `d6` e si vedono entrambe le quantità restare visibili fino al tiro. Con `1d8 - 1d4` il subtotale del `d4` viene sottratto e nessun dado del log mostra un valore negativo. Un tiro registrato prima del cambiamento resta leggibile e ripetibile con gli stessi criteri di calcolo. Le icone dei dadi sono le stesse nel tray e nel dettaglio della card, e l'attribuzione del set è raggiungibile nella tab Impostazioni da Master e Player allo stesso modo. Un tiro libero e un tiro dalla scheda mostrano la stessa card, entrambi con la formula in alto e il dettaglio che si apre al click su un totale, e differiscono soltanto perché il secondo riporta l'azione d'origine; il dettaglio di un tiro dalla scheda si apre anche usando la sola tastiera. Un bersaglio `1d20` doppio mostra due totali attivabili e un dettaglio solo. Le cinque tab stanno su una riga sola.

### P0.8 — Turni, HP e condizioni durante il combattimento

**Vincolo ereditato da P0.7.5:** un `d20` libero si risolve come coppia indipendente e `initiativeMode` sui token smette di avere senso. Un valore d'iniziativa però deve collassare a **un** numero per guidare l'ordine dei turni, e il tiro di massa (`rollForEveryone`) moltiplicherebbe quel momento per ogni creatura. Da P0.7.5 il motore conserva `advantage` e `disadvantage` senza produttori, in attesa di questa decisione: P0.8 li riattiva **solo** per l'iniziativa.

**Riferimento esterno.** Roll20 (scheda 5e) e Foundry (dnd5e) fanno scegliere la modalità **prima** del tiro d'iniziativa e mandano al tracker un solo numero; Foundry offre uno spareggio calcolato sulla Destrezza. Roll20 non applica danni in automatico: si scrive `-7` o `+5` sulla barra HP del token e il VTT fa il conto. P0.8 segue questi due modelli.

**Decisioni confermate:**

- **Fonte delle regole:** PHB 5e 2014. Dove il tavolo adotta una variante, è dichiarata qui.
- **Due modalità di sessione:** Esplorazione e Combattimento, commutate solo dal Master. In Esplorazione il movimento è libero, senza budget, non esiste turno attivo e il tiro d'iniziativa è disabilitato. Entrando in Combattimento il tracker si svuota, i partecipanti tirano l'iniziativa e il Master avvia il round 1. Uscendo, tracker, round, movimento usato e scatto si azzerano.
- **Modalità del tiro d'iniziativa come in Roll20:** accanto al riquadro Iniziativa della scheda un'icona impostazioni apre un selettore Normale/Vantaggio/Svantaggio. La scelta è un dato della scheda, così vale anche quando il Master tira al posto del Player; il server risolve il tiro con quella modalità e produce un valore solo. È l'unica eccezione alla regola di P0.7.5 per cui un `d20` non dichiara modalità.
- **Dove si tira:** dalla scheda e dalla tab Turni di iniziativa. Il risultato entra nella voce del token collegato e nel log dei dadi. Il Master può tirare per un Player che non l'ha fatto; `rollForEveryone` resta solo del Master.
- **Ordine e spareggio come in Foundry:** valore decrescente; a parità vince il modificatore di Destrezza più alto; a parità ulteriore decide una frazione casuale generata dal server al momento del tiro, mai mostrata. Variante dichiarata rispetto al PHB, che lascia gli spareggi a Master e giocatori. Lo spostamento o l'inserimento esplicito del Master prevale su ogni valore.
- **Turni:** li avanza il Master. Un'impostazione del Master, spenta di default, permette al Player di terminare il proprio turno quando il token attivo è suo.
- **Avvisi:** all'avvio del combattimento compare a tutti un annuncio con spade incrociate davanti a uno scudo (icone game-icons.net già in uso) e un effetto sonoro. «Sei il prossimo!» e «Tocca a te!» restano visibili solo al Player interessato e guadagnano un suono. Audio libero CC0 (pacchetto Kenney RPG Audio o equivalente); volume e silenziamento sono preferenze locali nella tab Impostazioni.
- **HP dei PG solo dalla scheda, senza automazione di attacchi e cure:** l'app non sa se un nemico ha *Scudo* o se un incantesimo cura, quindi un tiro non modifica mai gli HP da solo. Il campo degli HP attuali della scheda accetta, oltre a un valore assoluto, `-N` (danno) e `+N` (cura), con N intero da 1 a 999; il proprietario e il Master sono gli unici a poterlo fare. Il token non è un punto d'ingresso. I PNG senza scheda sono rinviati.
  - *Conto sul server*, sui valori correnti della scheda, così due `-N` quasi simultanei si sommano invece di sovrascriversi. Il danno scala prima gli HP temporanei e il resto gli HP attuali, fino a 0; l'eccedenza oltre 0 si ignora. La cura aggiunge fino al massimo, senza errore se lo supera, e non tocca i temporanei. Gli HP temporanei restano un valore assoluto scritto a mano: non si sommano e chi gioca sceglie quali tenere. `+N` senza HP massimi impostati viene rifiutato.
  - *Transizioni*, per qualunque via, anche un valore assoluto: HP attuali che scendono a 0 applicano Privo di sensi (e quindi Prono); HP che risalgono da 0 tolgono Privo di sensi, lasciano Prono e azzerano successi e fallimenti contro morte.
  - *Nessuna automazione* per tiri salvezza contro morte, morte istantanea da danno massiccio, resistenze, vulnerabilità e immunità.
  - *Visibilità:* gli HP di un token arrivano solo al Master e al proprietario; il server li toglie dallo snapshot di ogni altro Player. Sotto il token una barra mostra HP attuali e temporanei rispetto al massimo, con il numero esatto al passaggio del mouse o al fuoco e sempre nel nome accessibile; la vedono il Master su tutti i token e il Player solo sui propri. Senza HP massimi la barra non compare.
- **Condizioni PHB 2014:** le quattordici ufficiali (identificatori stabili in inglese, catalogo unico in `shared/token-conditions.mjs`) più Indebolimento a livello (`exhaustionLevel`, intero 0-6), in un menu radiale sul token (Player sul proprio, famiglio compreso, Master su tutti), aperto con click destro, `S` o `Shift+F10` quando nessuna interazione di mappa è in corso. Il menu mostra quattro icone per le più comuni — Prono, Afferrato, Trattenuto, Avvelenato — e un'icona `+` che apre le altre dieci più il livello di Indebolimento, per non affollarlo; ogni operazione (aggiungi/togli una condizione, imposta il livello) è validata e applicata dal server senza mai sostituire l'intero elenco, così due modifiche quasi simultanee si compongono invece di cancellarsi. Nessuna durata: si tolgono a mano. Invisibile è solo un marcatore — il token resta visibile e semitrasparente per chi già lo vedeva — distinto dal nascondimento del Master (`isInvisible`). L'unico effetto meccanico gestito è la velocità: 0 per Afferrato, Trattenuto, Paralizzato, Pietrificato, Stordito, Privo di sensi e Indebolimento 5+; dimezzata dal livello 2 a 4 di Indebolimento. Prono: un comando esplicito «Alzati» toglie la condizione e costa metà della velocità effettiva (gratis in Esplorazione e per il Master); muoversi restando proni significa strisciare, e ogni casella costa il doppio.
- **Risorse del turno:** si traccia solo il movimento; azione, azione bonus e reazione restano al tavolo.
- **Confine con P0.9:** le voci d'iniziativa dei PNG del Master arrivano con P0.9; P0.8 non introduce schede per i mostri.
- **Modale di modifica del token nascosta:** da `p0-8c` la modale non si apre più da nessun punto della GUI; il componente resta nel codice. I dati di un personaggio si modificano dalla scheda, le condizioni dal menu radiale. Fino a P0.9 il Master non ha una superficie per modificare nemici, oggetti e veicoli.
- **Aure senza automazione e senza preset:** l'app mostra l'area e avvisa chi ci si trova dentro; ricordare e applicare l'effetto resta compito dei giocatori. Niente modelli precompilati: il testo dei manuali non è nell'SRD e ogni aura si scrive a mano.
  - *Definizione nella scheda*, più aure per personaggio: nome, descrizione, effetto, raggio e colore. Il raggio si inserisce nell'unità della partita e si conserva in caselle. Definizione e stato acceso/spento vivono nella scheda e ne seguono patch, versione, SSE e persistenza. Poiché la scheda resta privata, il server proietta sul token (`auras`) solo nome, effetto, raggio, colore e stato, mai la descrizione; il token non è più modificabile direttamente per le aure, e le aure legacy, configurate finora dalla modale ora nascosta, vengono scartate.
  - *Accensione e spegnimento* dal menu radiale del token, per il proprietario e il Master. Nessuno spegnimento automatico, nemmeno con il proprietario Privo di sensi.
  - *Area secondo la griglia del PHB* (ogni casella costa 1, diagonali comprese), sempre, anche se il Master ha scelto la variante 5-10-5 per il movimento: un quadrato di caselle a partire dal bordo del token. Un token è dentro se almeno una sua casella cade nell'area. Tutte le aure sono visibili a tutti: il flag di visibilità attuale sparisce. Un'aura il cui proprietario è nascosto dal Master non raggiunge chi non vede il token, né come area né come avviso.
  - *Avviso persistente* in alto al centro per il Player con un token dentro un'aura accesa: «Sei nell'aura di Ilthar: Aura di protezione», una riga per aura, espandibile per leggerne l'effetto; nomina il famiglio quando è lui a trovarsi dentro. Resta finché il token è dentro e l'aura è accesa. Il proprietario non riceve l'avviso della propria aura; il Master vede le aree sulla mappa senza avvisi.
  - *Fuori ambito:* destinatari (alleati, nemici), promemoria nei tiri o nel log, avvisi di immunità e sospensione automatica.
  - *Rinviate:* aure dei mostri, aure ancorate a un punto spostabile della mappa e aure a cono (P0.9); aura proiettata da un token dentro un veicolo.
- **Quattro change, in quest'ordine:** `p0-8a` modalità di sessione, iniziativa, avvisi e fine turno opzionale; `p0-8c` condizioni, menu radiale e velocità (prima di `p0-8b`, perché gli HP a 0 devono applicare Privo di sensi); `p0-8d` aure; `p0-8b` HP con `±N`.

**Players**

- [x] Scegliere dalla scheda la modalità del proprio tiro d'iniziativa e tirare dalla scheda o dalla tab Turni, vedendo il risultato nella propria voce del tracker e nel log.
- [x] Ricevere «Sei il prossimo!» e «Tocca a te!» con un suono, e vedere il movimento residuo nel turno.
- [x] Terminare il proprio turno quando il Master lo consente.
- [ ] Aggiornare gli HP del proprio PG scrivendo `-N` o `+N` nella scheda.
- [ ] Vedere la barra della vita sotto il proprio token, e non gli HP degli altri.
- [x] Applicare e togliere condizioni sul proprio token dal menu radiale, e alzarsi da prono con «Alzati».
- [x] Definire nella scheda le aure del proprio personaggio e accenderle o spegnerle dal menu radiale del token.
- [x] Vedere un avviso in alto finché il proprio token è dentro l'aura accesa di un altro personaggio.

**Master**

- [x] Passare fra Esplorazione e Combattimento, con annuncio sonoro all'avvio.
- [x] Avanzare e correggere turno e round, tirare l'iniziativa al posto di un Player e inserire o spostare una voce in qualunque posizione, con valore manuale o tirato.
- [x] Consentire o no ai Player di terminare il proprio turno.
- [x] Applicare e togliere condizioni su qualunque token dal menu radiale.
- [x] Accendere e spegnere dal menu radiale le aure dei personaggi.
- [ ] Aggiornare dalla scheda gli HP di qualunque PG, e vedere la barra della vita sotto ogni token.

**Sistema**

- [x] Mantenere condivisi modalità di sessione, iniziativa, turno attivo e numero del round.
- [x] Risolvere lato server il tiro d'iniziativa con la modalità della scheda e collegarlo alla voce corretta del tracker.
- [x] Ordinare per valore, modificatore di Destrezza e frazione nascosta, conservando l'ordine esplicito del Master.
- [ ] Applicare `±N` sul server con l'ordine PHB degli HP temporanei, aggiornando scheda e token insieme; Privo di sensi a 0 HP, tolto con l'azzeramento dei contatori contro morte quando gli HP risalgono.
- [ ] Consegnare gli HP di un token solo al Master e al proprietario.
- [x] Ricavare la velocità disponibile dalle condizioni attive, addebitare «Alzati» sul budget del turno e raddoppiare il costo del movimento di un token prono.
- [x] Disegnare le aure accese sulla griglia a partire dal bordo del token, con la regola del PHB, senza applicarne gli effetti e senza rivelare un proprietario nascosto.

**Stato attuale:** `p0-8a` completata e archiviata (change `p0-8a-combat-mode-initiative`). La sessione ha le modalità Esplorazione e Combattimento, con fase di tiro prima del round 1; il budget di movimento vale solo a round avviato. Il tiro d'iniziativa è risolto dal server (`server/initiative-roll.mjs`) dalla scheda o dalla tab Turni, con la modalità salvata nella scheda, e scrive voce e log in una sola commit; l'ordine segue valore, Destrezza e frazione nascosta, e gli spostamenti del Master restano. Il Master avanza i turni dal server e può consentire ai Player di chiudere il proprio; annuncio con emblema, corno da battaglia e tamburi per «Tocca a te!» (asset CC0 locali), con volume e silenziamento locali. `p0-8c` completata e archiviata (change `p0-8c-token-conditions`). Le condizioni sono le quattordici del PHB 2014 più Indebolimento a livello, da un catalogo unico in `shared/token-conditions.mjs`; ogni aggiunta o rimozione passa da `POST /api/battle-map/token-conditions` come operazione singola, così le modifiche contemporanee di Master e Player si compongono, e Privo di sensi porta con sé Prono. Il server ricava la velocità effettiva dalle condizioni, rifiuta il movimento a velocità 0 anche in Esplorazione, addebita «Alzati» (`POST /api/battle-map/stand-up`) per metà della velocità a round avviato e raddoppia il costo delle caselle di chi striscia; la pianificazione mostra lo stesso costo. Il menu radiale si apre con click destro, `S` o `Shift+F10`, con tasti d'accesso, frecce e selettore di Indebolimento; i badge sul token sono tre più «+N» con icone game-icons.net, e Invisibile rende il token semitrasparente. La modale di modifica del token è nascosta. `p0-8d` completata e archiviata (change `p0-8d-token-auras`): le aure si definiscono nella scheda, si accendono dal menu radiale e producono aree e avvisi di presenza; verifiche automatiche, visive e manuali su tre ruoli superate. Gli HP con `±N` (`p0-8b`) restano da fare.

**Accettazione:** il Master passa in Combattimento e tutti vedono e sentono l'annuncio; un Player imposta Vantaggio accanto all'Iniziativa, tira dalla scheda e il tracker colloca il valore in ordine decrescente, con due valori pari ordinati per Destrezza. Il Master tira per un Player assente, sposta una voce a mano e avanza i turni; solo il Player interessato vede e sente «Sei il prossimo!» e «Tocca a te!». Un PG con 12 HP e 5 temporanei che riceve `-8` dalla scheda resta con 9 HP e 0 temporanei; con `-30` scende a 0 e diventa Privo di sensi e Prono; con `+1` torna a 1 HP, perde Privo di sensi, resta Prono e ha i contatori contro morte azzerati; con `+50` si cura fino al massimo. Un altro Player non vede né la barra né gli HP di quel PG, nemmeno nei dati ricevuti, mentre il Master vede la barra sotto ogni token. Un token Afferrato non può muoversi; un token prono che usa «Alzati» perde metà della velocità del turno, mentre uno che striscia per due caselle ne paga quattro. Tornando in Esplorazione il movimento è libero e il tracker è vuoto. Un Player definisce nella scheda un'aura di 10 piedi e la accende dal menu radiale: tutti vedono un quadrato di 5×5 caselle attorno al suo token 1×1, anche con la variante 5-10-5 attiva; un alleato che entra in una casella dell'area vede in alto «Sei nell'aura di Ilthar: Aura di protezione» finché resta dentro, e l'avviso sparisce quando esce o quando l'aura viene spenta.

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
