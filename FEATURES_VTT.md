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

**Stato attuale:** completato. Sono disponibili database locale, migrazioni versionate, controlli d'integrità, rollback dell'ultimo batch e schema iniziale. P0.2 ha collegato login e utenti al database; P0.4 userà il database per le schede. La persistenza delle sessioni di login e dello stato live della partita resta in P0.10.

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
- [x] Conservare in P0.2 le sessioni attive in memoria; la loro persistenza o il rinnovo automatico dopo il riavvio appartiene a P0.10.

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
- [x] Riutilizzare lo stato di iniziativa già presente per ordinamento visivo, evidenziazione del turno e modali legate alle transizioni. In P0.3 non aggiungere il tiro dalla scheda né nuove regole di inserimento o calcolo dell'iniziativa; queste arrivano dopo la scheda, in P0.7.
- [x] Riutilizzare e adattare la legenda dei comandi già presente, aggiungendo la sintassi dei tiri da comando.

**Stato attuale:** completato. La mappa affianca il pannello destro a quattro tab, i dadi sono calcolati autorevolmente dal server e il log è sincronizzato con SSE. I tiri pubblici e segreti sono filtrati per destinatario; log, iniziativa e avvisi turno sono disponibili senza chat testuale.

**Accettazione:** verificata con build e sessioni Master/Player. Su desktop la mappa occupa circa il 75% e il pannello destro circa il 25%; le quattro tab, zoom, spostamento della visuale e trascinamento dei token consentiti funzionano con pannello aperto o richiuso. I dadi sono configurati in una modale sulla mappa e disponibili da tutte le tab; due client vedono lo stesso tiro pubblico da click o `/r 1d20+5`, mentre un tiro segreto è visibile solo all'autore e al Master. Il log si aggiorna via SSE e mantiene visibile l’ultimo tiro. Con un ordine impostato, il Player riceve le due modali al cambio di turno. La chat testuale resta fuori da P0.3.

### P0.4 — Scheda personale a tab, caricabile e liberamente modificabile

**Riferimento UI:** [5E_CharacterSheet_Fillable.pdf](./5E_CharacterSheet_Fillable.pdf), composto da tre pagine. La scheda nell'app usa tre tab corrispondenti alle pagine del PDF, mantenendo campi modificabili e spazio per aggiunte personalizzate; il PDF è un riferimento alla struttura, non un vincolo a riprodurne l'impaginazione pixel per pixel.

**Architettura prevista:** repository espliciti per accesso e mappatura dei dati, policy per autorizzare proprietario, Master e player con permessi concessi, service transazionali per salvataggio, versioni e sincronizzazione con il token. Non introdurre una gerarchia di Model in stile Eloquent né un ORM completo.

**Players**

- [ ] Creare la propria scheda oppure caricare un file esistente da conservare come allegato.
- [ ] Supportare l'importazione di dati strutturati quando il formato è compatibile; per PDF e immagini offrire l'inserimento manuale, senza presumere una conversione automatica affidabile.
- [ ] Usare tre tab corrispondenti alle pagine del PDF: **Personaggio e combattimento**, **Aspetto e storia**, **Incantesimi**.
- [ ] Nella tab **Personaggio e combattimento** (pagina 1) modificare identità, caratteristiche, salvataggi, abilità, CA, iniziativa, velocità, HP, dadi vita, tiri salvezza contro morte, attacchi, equipaggiamento, monete, competenze, lingue, tratti della personalità, ideali, legami, difetti, privilegi e altri tratti.
- [ ] Nella tab **Aspetto e storia** (pagina 2) modificare aspetto, età, altezza, peso, occhi, pelle, capelli, alleati, organizzazioni, storia, tratti aggiuntivi e tesori.
- [ ] Nella tab **Incantesimi** (pagina 3) modificare classe e caratteristica da incantatore, CD, bonus d'attacco, trucchetti, incantesimi di livello 1–9, preparazione/conoscenza e slot totali/usati.
- [ ] Aggiungere sezioni o campi personalizzati e modificare liberamente valori, note, risorse, inventario, competenze, incantesimi e azioni.

**Master**

- [ ] Consultare e correggere le schede dei personaggi della campagna; assegnare esplicitamente eventuali permessi di accesso ad altri player.

**Sistema**

- [ ] Inizializzare la campagna corrente con il Master del roster e associare a essa le schede e i rispettivi proprietari.
- [ ] Salvare automaticamente la scheda su SQLite e conservarne una cronologia recuperabile, aggiungendo nuove migrazioni per versioni e allegati dove necessario.
- [ ] Verificare sul server i permessi di lettura e modifica: proprietario e Master, più eventuali player autorizzati esplicitamente; non affidarsi ai soli controlli della UI.
- [ ] Collegare la scheda al token, sincronizzando i valori scelti come HP, CA e velocità senza sovrascrivere modifiche manuali inattese.
- [ ] Conservare almeno caratteristiche, competenze, CA, HP, velocità, attacchi, salvataggi, risorse, inventario e incantesimi nei dati della scheda.

**Stato attuale:** esistono un roster fisso, alcuni dati sui token e la tabella `character_sheets`, ma non una scheda personale persistente ed editabile né le sue tab, versioni e allegati. P0.2 ha fornito l'identità e i ruoli necessari alla scheda; P0.3 prepara la tab Personaggi da cui aprirla.

**Accettazione:** un Player accede, crea o allega una scheda, compila le tre tab e ritrova i dati dopo un riavvio. Il Master può consultarla e correggerla; un altro Player senza permesso esplicito non può modificarla tramite API. Una versione precedente è recuperabile e i valori concordati compaiono sul token senza perdere modifiche manuali inattese.

**Decisione aperta prima della proposta P0.4:** una sola scheda attiva per ogni Player del roster, oppure più schede per lo stesso Player. Lo schema P0.1 consente entrambe le opzioni; non imporre un vincolo di unicità finché la scelta non è confermata.

### P0.5 — Tiri dalla scheda

**Players**

- [ ] Tirare prove, salvataggi, attacchi e danni dalla scheda, mantenendo disponibile il tiro libero di P0.3. Il collegamento del tiro di iniziativa al tracker arriverà con P0.7.
- [ ] Leggere nel log della tab Chat + Dadi i tiri generati dalla propria scheda, con formula, risultato e visibilità.

**Master**

- [ ] Leggere i tiri pubblici e segreti dei player e lanciare dadi nel contesto della sessione.

**Sistema**

- [ ] Usare il calcolo server e le regole di visibilità dei tiri introdotti in P0.3, anche per le azioni della scheda.
- [ ] Collegare ogni tiro al personaggio e, quando pertinente, all'azione usata sulla scheda.
- [ ] Mostrare chiaramente vantaggio, svantaggio, modificatori e dadi tenuti.

**Stato attuale:** il dice roller e il log condiviso esistono, ma non sono collegati alle azioni di una scheda personale.

**Accettazione:** due player vedono nel log lo stesso attacco pubblico tirato dalla scheda, con autore, formula e dettagli corretti; un tiro segreto della scheda è visibile solo all'autore e al Master. Il recupero del log dopo un riavvio è previsto in P0.10.

### P0.6 — Token del giocatore, movimento e misura

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

### P0.7 — Turni, HP e condizioni durante il combattimento

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

### P0.8 — Mappe e scene giocabili

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

### P0.9 — Preparazione dell'incontro e segreti

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

### P0.10 — Persistenza e recupero della partita

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

1. Master e player accedono con i profili del roster tramite il nuovo login; usano la mappa e le quattro tab del pannello destro. Un player carica e modifica la propria scheda nelle tre tab, il Master può consultarla e i dati scelti sono collegati al token.
2. Il master crea una scena vuota, disegna con la matita e colloca una roccia e un albero. I player vedono gli aggiornamenti ma non modificano la mappa. Il master importa anche una seconda mappa, ne calibra la griglia, prepara nemici nascosti e porta il party nella scena.
3. Un player tira un dado dai controlli in basso nel pannello e con `/r 1d20+5`, poi tira un attacco dalla scheda: tutti vedono i risultati pubblici generati dal server nel log. Un tiro segreto resta visibile solo all'autore e al Master.
4. Il player misura un percorso, fa ping sulla mappa e muove il proprio token: distanza, budget e posizione sincronizzata sono corretti.
5. Il Master rivela i nemici e avvia il combattimento; un Player sceglie il tipo di tiro di iniziativa dalla scheda, il Master può inserire una voce in qualsiasi posizione e le modali «Sei il prossimo!»/«Tocca a te!» seguono il turno. Iniziativa, HP e condizioni restano coerenti per tutti. Prima della rivelazione, i player non ricevono i dati dei nemici nascosti.
6. Il server viene riavviato: schede, scene, disegni, elementi predefiniti, posizioni, turni e log dei tiri tornano allo stato salvato automaticamente.

Il core loop è pronto solo quando questa prova riesce senza interventi manuali sui file o sul database.

Per completare P1, il player esegue anche un level up guidato, la visuale cambia automaticamente quando attraversa una porta e i tiri con destinatari personalizzati restano visibili solo ai partecipanti previsti. La chat testuale in tempo reale è prevista in P2.6.
