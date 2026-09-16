## Context

P0.1 ha già introdotto SQLite, le tabelle `campaigns` e `character_sheets` e il pattern repository; P0.2 ha aggiunto autenticazione, ruoli e service; P0.3 ha consolidato la sessione React/Fastify, il roster, lo stato autorevole della mappa e uno stream SSE filtrato per utente. La tabella `character_sheets` conserva oggi `owner_user_id`, `campaign_id`, `version` e `data_json`, ma non impone ancora l'unicità proprietario-campagna e non gestisce i ritratti.

La scheda deve seguire i contenuti delle tre pagine di `5E_CharacterSheet_Fillable.pdf`, restando però un'interfaccia web fluida e con collezioni espandibili. Le modifiche devono essere immediatamente condivise durante la sessione, mentre le scritture sincrone di `better-sqlite3` non devono avvenire a ogni tasto. Vedi `proposal.md` per la motivazione e le delta spec per il comportamento richiesto.

## Goals / Non-Goals

**Goals:**

- Inserire la scheda nel pattern repository, policy e service già adottato, mantenendo route e componenti sottili.
- Fornire un modello JSON tipizzato e versionabile che copra le tre tab e supporti elementi ripetibili con identità stabile.
- Separare lo stato live autorevole dalla frequenza di persistenza, senza perdere i dati nei normali punti di uscita.
- Applicare autorizzazioni e filtraggio SSE sul server, inclusi gli asset del ritratto.
- Integrare soltanto i valori esplicitamente condivisi con il token, con un flusso privo di aggiornamenti circolari.
- Tradurre la gerarchia del PDF in un sistema visivo web scuro, coerente con la sessione, accessibile e responsive.

**Non-Goals:**

- Implementare il motore delle regole 5e, calcoli derivati, avanzamento di livello o tiri dalla scheda.
- Importare o esportare PDF, JSON o formati di altri VTT.
- Conservare una cronologia completa delle revisioni o offrire modifica offline.
- Sincronizzare in senso inverso le modifiche fatte direttamente al token; l'eventuale flusso bidirezionale appartiene alla successiva gestione del combattimento.

## Decisions

### 1. Documento JSON strutturato con collezioni identificate

`data_json` conterrà un documento `CharacterSheetData` suddiviso in `character`, `story` e `spells`. I campi scalari manterranno il valore inserito dall'utente; attacchi, equipaggiamento, strumenti, linguaggi, privilegi, sezioni di risorse e incantesimi saranno array di elementi con un UUID stabile. Lo schema applicativo elencherà i percorsi aggiornabili e validerà tipo, dimensione e forma di ogni valore prima di modificare lo stato.

La struttura JSON permette di estendere la scheda senza una colonna per ciascuno dei numerosi campi del PDF e si adatta alle righe ripetibili. Tabelle normalizzate per ogni attacco o incantesimo renderebbero più complessi patch, caricamento e migrazioni senza offrire vantaggi alle query previste in questa applicazione locale. Un oggetto JSON libero senza schema è stato scartato perché sposterebbe gli errori sui client e renderebbe instabili i percorsi delle patch.

### 2. Evoluzione additiva dello schema esistente

Una nuova migrazione aggiungerà un indice univoco su `(owner_user_id, campaign_id)` e metadati nullable per il ritratto, come nome file gestito, media type e data di aggiornamento. Le migrazioni P0.1 già applicate non saranno modificate. Il bootstrap della campagna creerà in modo idempotente una scheda predefinita per ciascun `adventurer` del roster corrente.

I metadati del ritratto restano in colonne perché partecipano al ciclo di vita di un file e devono essere letti senza deserializzare l'intera scheda. Il contenuto dell'immagine resta nel filesystem locale; memorizzarlo come BLOB aumenterebbe dimensione e durata delle transazioni SQLite.

### 3. Repository, policy e service come confini del dominio

`CharacterSheetRepository` gestirà lettura, creazione idempotente e persistenza atomica di dati e versione. `CharacterSheetPolicy` deciderà accesso completo in base a identità, ruolo, proprietà e campagna. `CharacterSheetService` coordinerà validazione, patch, concorrenza, flush, ritratto e proiezione dei campi sul token. Le route Fastify convertiranno richieste e risposte e non conterranno decisioni di autorizzazione o merge.

Questa separazione segue l'architettura introdotta dalle milestone precedenti e rende verificabili autorizzazioni e concorrenza senza dipendere dall'interfaccia HTTP. Un modello attivo in stile Eloquent è stato scartato: le entità non devono aprire transazioni, applicare policy o conoscere lo stream della sessione.

### 4. API a patch e controllo dei conflitti per percorso

Le API offriranno la lettura della scheda autorizzata, l'applicazione di una patch e un flush esplicito. Una patch conterrà `baseVersion` e operazioni limitate ai percorsi registrati. Per ogni scheda live, il service manterrà l'ultima versione che ha modificato ciascun percorso. Una patch obsoleta sarà ancora accettata se i percorsi interessati non sono cambiati dopo `baseVersion`; in caso contrario riceverà `409` con versione, percorsi e valori correnti. Le collezioni useranno percorsi basati sull'ID dell'elemento, così due righe differenti non entreranno in conflitto.

Questo meccanismo conserva modifiche concorrenti indipendenti ed evita l'ultimo-salvataggio-vince dell'intero documento. JSON Patch generico è stato scartato perché permette operazioni e percorsi che il dominio non intende esporre; un lock esclusivo della scheda è stato scartato perché impedirebbe la collaborazione naturale tra Master e Player.

### 5. Stato live nel server e persistenza con debounce

Il service manterrà in memoria, per ogni scheda attiva, documento, versione, mappa dei percorsi modificati, stato dirty e timer. Ogni patch accettata aggiornerà e trasmetterà subito questo stato. Un timer rinnovabile persisterà l'ultima versione dopo circa un secondo di inattività. Le route di chiusura scheda, logout e fine o sospensione della sessione richiameranno un flush; l'hook di chiusura ordinata di Fastify svuoterà tutte le schede dirty. Se la scrittura fallisce, lo stato resta dirty e viene emesso un errore di persistenza agli utenti autorizzati.

Salvare soltanto a fine sessione esporrebbe tutte le modifiche a una perdita per crash. Scrivere ogni input produrrebbe transazioni sincrone inutili. Il debounce server-side offre aggiornamenti live immediati, una finestra di perdita limitata ai crash improvvisi e non dipende dall'affidabilità dell'evento di chiusura del browser.

### 6. Eventi SSE mirati sullo stream esistente

Lo stream `/battle-map/stream` riceverà eventi nominati per patch, persistenza e aggiornamento pubblico del ritratto. Gli eventi completi della scheda saranno inviati soltanto alle connessioni del proprietario e del Master, usando l'identità già associata a ogni client. Lo snapshot generico della mappa non conterrà la scheda. Il roster potrà ricevere un riferimento pubblico e opaco al ritratto aggiornato, senza includere dati privati.

Riutilizzare lo stream esistente evita una seconda connessione e mantiene un solo ciclo di riconnessione. Inserire la scheda nello snapshot della mappa è stato scartato perché aumenterebbe il payload e rischierebbe di esporre dati agli altri Player.

### 7. Ritratto gestito fuori dalla directory pubblica

L'upload userà multipart con limite di 5 MB. Il service verificherà sia il tipo dichiarato sia la firma del contenuto per JPEG, PNG e WebP, scriverà prima un file temporaneo con nome generato e lo rinominerà atomicamente. Il database punterà al nuovo file soltanto dopo una scrittura riuscita; il vecchio file sarà eliminato dopo il commit. I file saranno letti da una route autenticata che applica la visibilità del roster, invece di esporre direttamente la directory.

È prevista l'aggiunta di `@fastify/multipart`; una stringa base64 nel JSON è stata scartata per dimensione, duplicazione negli eventi e maggior costo di serializzazione. Fidarsi della sola estensione o del `Content-Type` client è stato scartato perché non valida il contenuto ricevuto.

### 8. Finestra React flottante e stato locale riconciliato

La tab Personaggi aprirà `CharacterSheetWindow`, una finestra non modale, accessibile e responsive che conserva la sessione montata e utilizzabile sotto di sé. Sul desktop il contenitore riprenderà la proporzione della finestra personaggio Roll20, circa 1,35:1, con larghezza contenuta, altezza prossima a quella disponibile e scorrimento verticale interno. La testata fungerà da maniglia di trascinamento; il movimento tramite puntatore o `Alt` più tasti freccia verrà limitato al viewport e l'ultima posizione valida verrà conservata localmente. Sotto il breakpoint compatto la finestra occuperà il viewport e il trascinamento verrà disabilitato.

Il contenitore coordinerà `useCharacterSheet`, indicatore di salvataggio e conflitti; tre componenti di tab renderanno le rispettive sezioni e componenti riutilizzabili gestiranno campi e righe ripetibili. Il client aggiornerà subito la bozza locale, invierà patch granulari e riconcilierà conferme o eventi SSE per versione. In caso di `409`, manterrà il valore locale e mostrerà insieme il valore corrente del server. La finestra manterrà Escape e ripristino del focus, ma non intrappolerà il focus perché la superficie di sessione esterna resta intenzionalmente interattiva.

Un unico componente monolitico in `App.tsx` è stato scartato per la quantità di campi e stati. Una pagina separata e un dialog modale con fondale bloccante sono stati scartati perché perderebbero il contesto visivo della mappa e impedirebbero il flusso multitasking mostrato dalla reference Roll20.

### 9. Sistema visivo "Grimorio di brace" derivato dalla composizione del PDF

Le tre pagine renderizzate di `5E_CharacterSheet_Fillable.pdf` saranno il riferimento per gerarchia e contenuti, mentre la finestra personaggio Roll20 fornita dal creator sarà il riferimento per proporzioni, densità e comportamento nel workspace. La superficie seguirà la direzione "Grimorio di brace", coerente con il mondo cromatico della sessione: token per superfici carbone e bordeaux profondo, inchiostro avorio, toni attenuati, cornici, accento brace riservato a focus e stato di salvataggio, stati dei punti ferita e un font display condensato a cifre tabulari per i valori. Gli smussi dei riquadri saranno ottenuti con bordi e sfondi invece di `clip-path`, così da non tagliare focus e ombre. Il modificatore delle caratteristiche diventerà il numero primario e i punti ferita avranno una barra puramente visiva derivata dai valori inseriti. Componenti riutilizzabili come `SheetPanel`, `FramedValue`, `SectionLabel`, `AbilityBlock` e `SpellLevelSection` costruiranno la stessa grammatica visiva senza incorporare il PDF come sfondo.

Il foglio chiaro fedele alla stampa è stato scartato perché crea uno stacco di luminosità con la mappa scura durante la sessione; un tema glass o neon generico è stato scartato perché perderebbe il legame con la gerarchia del PDF.

Sul desktop ogni tab userà CSS Grid per preservare i gruppi e i rapporti principali della pagina dentro una superficie più stretta: due colonne principali nella prima tab con i pannelli narrativi a tutta larghezza, grandi pannelli asimmetrici nella seconda e due colonne verticali di livelli nella terza. La scheda privilegerà lo sviluppo e lo scorrimento verticale invece di espandersi orizzontalmente. A larghezze inferiori, i gruppi seguiranno l'ordine di lettura del PDF in una sola colonna. I campi manterranno target e testo leggibili, focus visibile e contrasto conforme all'interfaccia esistente anche quando ciò richiede dimensioni maggiori rispetto alla stampa.

I componenti che rappresentano valori tirabili in P0.5 — caratteristiche, salvezze, abilità, iniziativa, attacchi e incantesimi — manterranno confini e identificatori stabili affinché un futuro comando contestuale possa essere inserito accanto al valore senza allargare la finestra o ridisegnare la griglia. P0.4 non mostrerà né eseguirà tiri.

La resa cerca continuità grafica e gerarchica, non una copia pixel per pixel: logo, marchi e illustrazioni del PDF non saranno riutilizzati. Un layout generico a form è stato scartato perché perderebbe la riconoscibilità della scheda; usare il PDF come immagine di sfondo è stato scartato perché fragile, poco accessibile e inadatto ai contenuti ripetibili.

### 10. Proiezione unidirezionale dalla scheda al token

Dopo una patch accettata, il service tradurrà soltanto nome, HP massimi, attuali e temporanei, velocità e modificatore di iniziativa nei campi del token associato e userà il meccanismo autorevole della mappa per distribuirli. Ritratto e Classe Armatura non entreranno nella proiezione. In P0.4 la scheda è la sorgente per questi valori; le modifiche dirette al token non saranno riscritte nella scheda.

Una sincronizzazione bidirezionale è stata scartata in questa milestone perché richiederebbe regole di precedenza e conflitto tra due domini modificabili, sovrapponendosi alla futura logica di combattimento.

## Risks / Trade-offs

- [Un arresto improvviso può precedere il prossimo debounce] → mantenere il debounce breve, persistente sul server, e forzare il flush in tutti i punti di uscita controllati.
- [La mappa dei percorsi modificati cresce durante una sessione lunga] → conservare una sola versione per percorso e rimuovere le voci quando non servono più dopo una persistenza e quando nessun client usa versioni precedenti.
- [Un documento JSON malformato proveniente da una versione precedente può impedire il caricamento] → validare al confine del repository e applicare migrazioni di documento esplicite prima di inserirlo nello stato live.
- [File orfani possono restare dopo un crash tra filesystem e commit] → usare file temporanei e una pulizia al bootstrap per temporanei e file non referenziati.
- [La scheda completa può essere pesante su schermi piccoli] → mantenere una sola tab montata visivamente, usare sezioni collassabili e rendere la finestra a schermo intero sotto il breakpoint mobile.
- [Una finestra trascinata può finire fuori schermo dopo un ridimensionamento] → limitare ogni movimento al viewport e ricontrollare la posizione all'apertura e al resize.
- [La finestra non modale può confondere l'ordine del focus] → usare una testata focalizzabile con istruzioni accessibili, mantenere Escape e ripristino del focus e lasciare un ordine di tabulazione naturale tra scheda e workspace.
- [La fedeltà al foglio stampato può ridurre leggibilità o flessibilità] → preservare gerarchia e identità visiva, ma lasciare che accessibilità, contenuti dinamici e breakpoint determinino dimensioni e riflusso.
- [Una superficie scura con testi piccoli e densi può ridurre la leggibilità] → token con contrasto AA verificato, etichette di almeno circa 11px e cifre tabulari per i valori.
- [La proiezione unidirezionale può sorprendere chi modifica direttamente il token] → indicare nell'interfaccia quali valori sono collegati e documentare che la scheda li governa in P0.4.

## Migration Plan

1. Applicare una nuova migrazione che aggiunge i metadati del ritratto e l'unicità proprietario-campagna; verificare prima che non esistano duplicati.
2. Distribuire schema del documento, repository, policy, service e bootstrap idempotente. Le righe esistenti con un documento vuoto o precedente vengono normalizzate alla versione corrente senza perdere valori riconosciuti.
3. Attivare API, upload, cache live, debounce e nuovi eventi SSE con test di autorizzazione e concorrenza.
4. Collegare la UI della scheda e il roster alle API, poi abilitare la proiezione dei soli campi concordati sul token.
5. Verificare con due sessioni browser, una da Master e una da Player, aggiornamenti concorrenti, riavvio e sostituzione del ritratto.

Per il rollback, disabilitare prima UI e route P0.4 e forzare il flush delle schede dirty. La migrazione down può rimuovere indice e colonne aggiunte; i file dei ritratti possono essere conservati per un successivo ripristino o rimossi solo dopo aver verificato che non servano. Le migrazioni precedenti e i dati del roster restano intatti.
