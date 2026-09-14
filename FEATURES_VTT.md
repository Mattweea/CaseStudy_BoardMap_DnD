# Roadmap VTT — core loop

## Obiettivo

Rendere l'app utilizzabile per completare un incontro come in un VTT: il giocatore apre la scheda, tira i dadi, muove il token, segue il turno e aggiorna le proprie risorse; il master prepara la mappa e gestisce il combattimento. Il riferimento è il [flusso di gioco essenziale di Roll20](https://help.roll20.net/hc/en-us/articles/29258224833431-10-Using-Roll20-to-play), non la replica di tutte le sue funzioni.

## Base già presente

Il progetto include token e ostacoli, ruoli master/player, sincronizzazione SSE, movimento dei player, HP, alcune condizioni, dadi, iniziativa, luci, visione, undo e snapshot manuali. Le voci seguenti indicano funzioni mancanti oppure comportamenti da completare e verificare; non sostituiscono un test funzionale con più client.

## P0 — indispensabile per una sessione

P0.1 prepara il database, P0.2 rende stabili identità e ruoli, P0.3 rende persistenti le schede. Le feature successive seguono l'utilità immediata per i giocatori; non costituiscono una sequenza rigida di implementazione. Il traguardo P0 è poter giocare un incontro completo su una mappa condivisa.

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

**Stato attuale:** completato. Sono disponibili database locale, migrazioni versionate, controlli d'integrità, rollback dell'ultimo batch e schema iniziale. P0.2 collegherà login e utenti al database, P0.3 userà il database per le schede; la persistenza delle sessioni di login e dello stato live della partita resta in P0.9.

**Accettazione:** su un checkout pulito `npm run db:migrate` crea il database e le tabelle; rilanciarlo non modifica nulla. Una nuova migrazione si applica una sola volta, `db:status` ne mostra lo stato e `db:rollback` annulla l'ultimo batch in un database di sviluppo.

### P0.2 — Ruoli e login del roster

**Decisioni confermate:** mantenere il roster attuale e soltanto i ruoli `master` e `adventurer` (Player nell'interfaccia), senza Admin né registrazione libera. La password iniziale letterale `password` è comune a tutti i profili e viene conservata solo come hash bcrypt. Nell'uso locale tra amici questo facilita l'accesso, ma chi conosce la password può entrare come un altro profilo: i ruoli non garantiscono un'identità riservata. Le sessioni di login possono restare in memoria; dopo il riavvio del server si effettua nuovamente il login.

**Players**

- [ ] Selezionare il proprio profilo del roster, inserire la password e accedere con uno stato di errore chiaro in caso di credenziali non valide.
- [ ] Ritrovare il proprio profilo e i relativi permessi dopo un refresh del browser finché la sessione è valida; poter uscire con logout.

**Master**

- [ ] Accedere con il profilo Master e conservare i controlli della mappa riservati a questo ruolo.

**Sistema**

- [ ] Creare con una nuova migrazione la tabella `roles`, con codici univoci `master` e `adventurer`, e collegare `users` a `roles` tramite chiave esterna. Non modificare le migrazioni P0.1 già applicate né mantenere due fonti di verità per il ruolo.
- [ ] Inizializzare in SQLite gli utenti del roster con ID stabili, ruolo e hash bcrypt della password comune; mantenere i profili statici soltanto per i dati di presentazione e di gioco ancora necessari.
- [ ] Leggere gli utenti dal database durante il login, verificare la password con bcrypt e derivare ruolo e permessi dall'utente autenticato sul server, senza fidarsi del ruolo inviato dal client.
- [ ] Aggiornare il frontend del login per il roster esistente: selezione del profilo, inserimento della password senza precompilare le vecchie credenziali `${username}123`, stati di caricamento/errore, sessione e logout comprensibili.
- [ ] Conservare in P0.2 le sessioni attive in memoria; la loro persistenza o il rinnovo automatico dopo il riavvio appartiene a P0.9.

**Stato attuale:** completato: `roles` e `users.role_code` sono migrati in SQLite, il roster viene inizializzato idempotentemente con hash bcrypt e le API risolvono l'identità della sessione dal database. Le sessioni restano in memoria e il frontend richiede esplicitamente la password comune.

**Accettazione:** dopo `db:migrate` e l'inizializzazione del roster, Master e Player accedono dal frontend con `password`; le vecchie credenziali non funzionano. Refresh e logout funzionano; il server continua a distinguere i permessi Master/Player anche se il client invia un ruolo diverso. Non compaiono account o interfacce Admin.

### P0.3 — Scheda personale a tab, caricabile e liberamente modificabile

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

**Stato attuale:** esistono un roster fisso, alcuni dati sui token e la tabella `character_sheets`, ma non una scheda personale persistente ed editabile né le sue tab, versioni e allegati. P0.2 fornirà l'identità e i ruoli necessari a P0.3.

**Accettazione:** un Player accede, crea o allega una scheda, compila le tre tab e ritrova i dati dopo un riavvio. Il Master può consultarla e correggerla; un altro Player senza permesso esplicito non può modificarla tramite API. Una versione precedente è recuperabile e i valori concordati compaiono sul token senza perdere modifiche manuali inattese.

**Decisione aperta prima della proposta P0.3:** una sola scheda attiva per ogni Player del roster, oppure più schede per lo stesso Player. Lo schema P0.1 consente entrambe le opzioni; non imporre un vincolo di unicità finché la scelta non è confermata.

### P0.4 — Tiri dalla scheda e comunicazione condivisa

**Players**

- [ ] Tirare prove, salvataggi, attacchi, danni e iniziativa dalla scheda, mantenendo disponibile il tiro libero.
- [ ] Offrire una chat testuale di base, nello stesso contesto dei tiri, per dichiarare azioni e leggere gli esiti.

**Master**

- [ ] Leggere gli stessi tiri e messaggi dei player, inviare messaggi e lanciare dadi nel contesto della sessione.

**Sistema**

- [ ] Inviare al server la richiesta di tiro; il server genera risultato, formula, autore e timestamp e li pubblica nel log condiviso.
- [ ] Collegare ogni tiro al personaggio e, quando pertinente, all'azione usata sulla scheda.
- [ ] Mostrare chiaramente vantaggio, svantaggio, modificatori e dadi tenuti.

**Stato attuale:** il dice roller e il log condiviso esistono, ma il risultato è generato nel browser e il server accetta un log già compilato. Non c'è una chat testuale.

**Accettazione:** due player vedono nella chat lo stesso attacco tirato dalla scheda, con autore e dettagli corretti; il risultato è generato dal server e resta disponibile dopo un riavvio.

### P0.5 — Token del giocatore, movimento e misura

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

### P0.6 — Turni, HP e condizioni durante il combattimento

**Players**

- [ ] Tirare l'iniziativa dalla scheda e vedere il risultato nella propria voce del tracker.
- [ ] Mostrare al player quando tocca a lui e quanto movimento o risorse gli restano nel turno.
- [ ] Vedere danni, cure, HP temporanei e condizioni aggiornarsi su scheda e token durante il combattimento.

**Master**

- [ ] Avviare e avanzare il combattimento, correggere iniziativa e turno, applicare danni, cure e condizioni ai bersagli.

**Sistema**

- [ ] Mantenere condivisi iniziativa, turno attivo e numero del round.
- [ ] Collegare l'iniziativa tirata dalla scheda alla voce corretta del tracker.
- [ ] Applicare danni, cure e HP temporanei al bersaglio in pochi passaggi, aggiornando scheda e token insieme.
- [ ] Usare marcatori di condizione specifici, con durata o scadenza quando pertinente.

**Stato attuale:** iniziativa, round, HP e alcune condizioni sono già presenti, ma non sono collegati a una scheda personale e alle sue azioni.

**Accettazione:** il master avvia l'incontro, un player tira iniziativa dalla scheda, compie il proprio turno e vede HP, condizioni e risorse aggiornarsi in modo coerente su scheda, token e tracker.

### P0.7 — Mappe e scene giocabili

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

### P0.8 — Preparazione dell'incontro e segreti

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

### P0.9 — Persistenza e recupero della partita

**Players**

- [ ] Ritrovare posizione, risorse e chat dopo una riconnessione o un riavvio del server, insieme alla scheda già salvata in P0.3.

**Master**

- [ ] Recuperare almeno una versione precedente della partita ed esportare o importare una sessione completa, comprese scene e asset.

**Sistema**

- [ ] Spostare lo stato live di scene, token, combattimento, chat e log dalle sole variabili in memoria al database SQLite creato in P0.1.
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

### P1.3 — Comunicazioni e tiri riservati

**Players**

- [ ] Inviare un tiro o un messaggio visibile solo al master.

**Master**

- [ ] Effettuare tiri riservati e inviare messaggi privati a uno o più player.

**Sistema**

- [ ] Limitare consegna e persistenza di tiri e messaggi ai destinatari previsti, mantenendo separata la cronologia pubblica.

**Accettazione:** un tiro riservato compare solo ai destinatari previsti e resta privato anche dopo riconnessione o ripristino della sessione.

## P2 — utilità di sessione

**Players**

- [ ] **P2.1** — Consultare handout condivisi dal master secondo i permessi assegnati.
- [ ] **P2.5** — Vedere lo stato della propria connessione e un segnale chiaro di riconnessione.

**Master**

- [ ] **P2.1** — Creare handout e assegnare i permessi di visualizzazione.
- [ ] **P2.2** — Gestire una libreria di immagini e token riutilizzabili fra scene.
- [ ] **P2.3** — Gestire livelli avanzati per sfondo, token, annotazioni riservate e ostacoli.
- [ ] **P2.4** — Duplicare, archiviare e cercare le scene.
- [ ] **P2.5** — Vedere presenza e stato di connessione dei player.

**Sistema**

- [ ] **P2.3** — Applicare visibilità e permessi ai livelli avanzati, mantenendo separati i dati riservati del master.

## Prova del core loop P0

Dopo `npm run db:migrate`, con master e almeno due player collegati da browser distinti:

1. Master e player accedono con i profili del roster tramite il nuovo login; un player carica e modifica la propria scheda nelle tre tab, il master può consultarla e i dati scelti sono collegati al token.
2. Il master crea una scena vuota, disegna con la matita e colloca una roccia e un albero. I player vedono gli aggiornamenti ma non modificano la mappa. Il master importa anche una seconda mappa, ne calibra la griglia, prepara nemici nascosti e porta il party nella scena.
3. Un player dichiara un'azione in chat, tira dalla scheda e tutti vedono lo stesso risultato generato dal server.
4. Il player misura un percorso, fa ping sulla mappa e muove il proprio token: distanza, budget e posizione sincronizzata sono corretti.
5. Il master rivela i nemici e avvia il combattimento; iniziativa, turno, HP e condizioni restano coerenti per tutti. Prima della rivelazione, i player non ricevono i dati dei nemici nascosti.
6. Il server viene riavviato: schede, scene, disegni, elementi predefiniti, posizioni, turni, chat e log tornano allo stato salvato automaticamente.

Il core loop è pronto solo quando questa prova riesce senza interventi manuali sui file o sul database.

Per completare P1, il player esegue anche un level up guidato, la visuale cambia automaticamente quando attraversa una porta e i tiri riservati restano visibili solo ai destinatari previsti.
