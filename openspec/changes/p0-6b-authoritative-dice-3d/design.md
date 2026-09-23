## Context

La motivazione è descritta in `proposal.md`. P0.6a espone già in ogni `DiceRollLog` moderno il dettaglio autorevole per dado (`id`, `groupId`, `sides`, `value`, `disposition`); P0.6b deve consumarlo senza ricalcolare formule o introdurre stato condiviso. Oggi `useBattleMapState` applica snapshot completi sia dalle risposte HTTP sia dal flusso SSE, mentre `App` monta una `Board` ordinaria e, durante il fullscreen, una seconda istanza. La presentazione deve quindi distinguere i nuovi log dalla baseline e avere un unico proprietario anche quando cambia la superficie visibile.

`@3d-dice/dice-box-threejs` richiede WebGL e asset statici, non pubblica tipi TypeScript nel pacchetto e risolve i tiri in modo asincrono. La sua notazione permette risultati forzati, ma la scena rimane un effetto locale: log, totale, autorizzazione e persistenza continuano a dipendere esclusivamente dal server e dal contratto di P0.6a.

## Goals / Non-Goals

**Goals:**

- mantenere un solo controller locale della presentazione e una sola coda ordinata per client;
- tradurre il dettaglio autorevole in un modello di presentazione puro e testabile, compreso il percentile;
- caricare renderer e asset soltanto quando un tiro è effettivamente animabile;
- isolare ogni errore grafico dal flusso applicativo e dalle mutazioni condivise;
- preservare interazioni, focus, privacy già sanitizzata dal server e comportamento numerico esistente.

**Non-Goals:**

- usare la fisica per determinare o verificare il risultato di gioco;
- aggiungere endpoint, eventi SSE, campi persistiti o preferenze personali;
- dipendere da API interne della libreria per modificare materiali dei singoli mesh;
- introdurre audio, comando di salto, temi, telemetria o recupero automatico della scena nella stessa sessione dopo un errore fatale.

## Decisions

### 1. Renderer fissato, caricato dinamicamente e servito con asset locali

La dipendenza sarà fissata alla versione esatta `@3d-dice/dice-box-threejs@0.0.12`, con una dichiarazione TypeScript locale limitata alle API usate. Un comando riproducibile copierà nella directory pubblica gli asset necessari del pacchetto; il runtime non userà CDN e l'audio resterà disattivato. Il modulo sarà importato dinamicamente solo al primo elemento animabile, dopo i controlli di movimento ridotto e WebGL.

Questo riduce bundle iniziale e failure surface rispetto a un import eager. Copiare manualmente file non tracciati o usare asset remoti è stato scartato perché renderebbe build e deploy non deterministici. La versione flottante è stata scartata perché il pacchetto e il relativo formato degli asset non offrono un contratto sufficientemente stabile per aggiornamenti impliciti.

### 2. Modello di presentazione puro, senza reinterpretare il tiro

Un adapter puro convaliderà `DiceRollLog.dice` e produrrà:

- la sequenza stabile dei modelli richiesti al renderer e delle facce forzate;
- un riepilogo semantico ordinato per `groupId`, con identità e `disposition` di ogni dado;
- l'eventuale motivo di fallback, senza lanciare eccezioni verso React.

I d4, d6, d8, d10, d12 e d20 mantengono il proprio valore. Ogni d100 logico genera invece due modelli visivi: il dado delle decine usa `100` per la faccia `00`, altrimenti il multiplo di dieci; il dado delle unità usa `10` per la faccia `0`, altrimenti la cifra delle unità. Ne risultano `07` per 7, `40` per 40 e `00` per 100. Il totale restituito dal renderer non viene letto come dato di gioco.

Il limite resta di 20 dadi logici per voce. Se il dettaglio lo supera, contiene lati o valori non supportati, duplicati d'identità o campi incoerenti, l'intera voce degrada al log numerico: non viene mostrato un sottoinsieme potenzialmente fuorviante. L'espansione di un d100 in due modelli non modifica questo conteggio.

Ricostruire i dadi dalla formula è stato scartato perché perderebbe gruppi, disposizioni e casi prodotti dalla scheda. Correggere o completare dati malformati nel client è stato scartato perché introdurrebbe una seconda interpretazione non autorevole.

### 3. Disposizione e gruppi resi in un riepilogo semantico supportato

La scena mostra i modelli sui valori forzati; al termine, un result rail sovrapposto e non interattivo associa i risultati agli stessi `id` e `groupId`: `kept` ha enfasi piena, `discarded` è attenuato e `unresolved` resta neutro. I gruppi hanno etichette o separatori coerenti. Il rail non crea una seconda live region, perché il log numerico esistente comunica già il risultato alle tecnologie assistive.

Modificare colore o opacità dei mesh tramite strutture interne della libreria è stato scartato: non esiste un'API pubblica per correlare stabilmente ogni modello al dado logico, e l'approccio renderebbe fragile l'aggiornamento della dipendenza. Il rail mantiene verificabile la semantica anche se due modelli terminano sovrapposti.

### 4. Feed locale di nuove consegne e baseline esplicita

`useBattleMapState` esporrà un piccolo segnale locale di consegna per la presentazione, separato da `BattleMapSharedState`. Il caricamento HTTP iniziale e il primo snapshot di ogni nuova connessione SSE stabiliscono soltanto la baseline degli id visibili. Le risposte HTTP a un tiro e gli snapshot SSE successivi pubblicano i soli log non ancora consegnati; il controller deduplica comunque per `DiceRollLog.id`, così la coppia risposta HTTP/broadcast non produce due animazioni.

Il primo messaggio di ogni generazione SSE sarà riconosciuto localmente dopo `open`/riconnessione e usato per riallineare la baseline. I log comparsi mentre il client era offline non vengono quindi rianimati. La derivazione avviene solo dopo `normalizeSharedState` e usa esclusivamente i log già sanitizzati ricevuti da quel client, preservando la privacy senza logica di ruolo aggiuntiva nel renderer.

Osservare soltanto `state.diceLogs` in un effect è stato scartato: non distingue una mutazione live da uno snapshot completo di riconnessione. Aggiungere il feed allo snapshot condiviso è stato scartato perché trasformerebbe un effetto effimero in un contratto realtime e persistito.

### 5. Una coda sequenziale con timeout e fallback per voce

Un controller possiede `seenIds`, una coda FIFO e un solo consumer asincrono. Ogni id viene considerato gestito prima dell'avvio; il consumer attende il completamento del tiro corrente prima di iniziare il successivo. Ogni operazione ha un timeout: a scadenza o errore, la scena viene ripulita per quanto possibile e la coda prosegue. Un fallimento di inizializzazione o runtime considerato fatale disabilita il renderer per il resto della sessione browser, drena gli elementi come fallback numerici e non mostra errori bloccanti.

La serializzazione evita sovrapposizioni e promise irrisolte della libreria quando parte un nuovo tiro durante quello corrente. Avviare scene concorrenti o interrompere il tiro precedente è stato scartato perché perderebbe ordine, leggibilità e affidabilità. Il controller non ritarda mai l'inserimento del log né attende l'animazione per risolvere `rollDice`.

### 6. Un solo overlay sopra la Board attiva

`App` ospiterà il controller e `Dice3DOverlay`; ciascuna `Board` comunicherà tramite callback il proprio elemento host, ma soltanto la board attiva — ordinaria oppure fullscreen — sarà la destinazione della scena. Il cambio di host riutilizza la stessa coda e la stessa istanza del renderer, riallineandone le dimensioni senza duplicare il tiro. L'istanza resta montata dopo la prima inizializzazione perché la libreria non espone un ciclo di distruzione completo; quando inattiva, il canvas viene nascosto e non riceve lavoro.

Overlay e rail useranno `position: absolute`, `pointer-events: none`, `aria-hidden` per la parte puramente grafica e nessun elemento focalizzabile. Le dimensioni seguiranno l'host mediante `ResizeObserver`, senza entrare nelle trasformazioni di camera, zoom o coordinate della griglia.

Montare un overlay indipendente dentro ognuna delle due `Board` è stato scartato perché durante la transizione fullscreen entrambe possono esistere e accodare lo stesso log. Posizionare la scena sul viewport globale è stato scartato perché non rispetterebbe i limiti della superficie della mappa.

### 7. Accessibilità e capacità verificate prima del caricamento

Il controller verifica `prefers-reduced-motion: reduce` e la creazione di un contesto WebGL prima dell'import dinamico. Una variazione della media query verso `reduce` impedisce nuovi tiri e termina la sola presentazione corrente senza toccare il log; il ritorno a movimento pieno abilita i tiri futuri se il renderer non è in errore fatale. Log legacy o non animabili vengono marcati gestiti senza inizializzare la libreria.

Mostrare un toast di errore è stato scartato perché il risultato numerico è già completo e un problema decorativo non deve interrompere il gioco. Un controllo basato soltanto sul supporto nominale del browser è stato scartato perché la creazione effettiva del contesto può fallire.

### 8. Verifica automatica del dominio locale e verifica manuale della scena

I test Node copriranno adapter, percentile, limite/fallback, deduplica, ordine, baseline iniziale e riconnessione, timeout ed errore. La scena reale verrà verificata manualmente su board normale e fullscreen, con due sessioni per visibilità pubblica/segreta, durante drag/zoom/controlli e con movimento ridotto o WebGL/asset non disponibili. Non viene introdotto un nuovo runner DOM/WebGL solo per P0.6b: gli aspetti grafici e di focus restano criteri manuali espliciti, mentre la logica deterministica è estratta e testata.

## Risks / Trade-offs

- [Il pacchetto è giovane e dipende da versioni specifiche di ThreeJS/Cannon ES] → fissare la versione, confinare l'integrazione dietro un adapter e verificare gli aggiornamenti separatamente.
- [La libreria non offre cleanup completo e registra risorse browser] → mantenere una sola istanza per la vita dell'app e non rimontarla durante fullscreen o inattività.
- [Asset mancanti o incompatibili possono fallire solo a runtime] → copia riproducibile, controllo in build e fallback numerico non bloccante.
- [Una raffica di tiri può allungare la coda] → FIFO, timeout per voce e nessun blocco delle azioni; il comando di salto resta fuori scope per P0.6c.
- [Un d100 raddoppia i modelli e può pesare su GPU modeste] → limite sui dadi logici, import lazy e fallback all-or-nothing in caso di errore.
- [Il result rail non modifica direttamente i mesh] → privilegiare una semantica stabile e leggibile rispetto a personalizzazioni basate su internals non supportati.
- [La prima consegna dopo una riconnessione può contenere tiri avvenuti offline] → trattarla intenzionalmente come baseline, come richiesto, anche se il client non vedrà la loro animazione.

## Migration Plan

1. Aggiungere dipendenza fissata, dichiarazione locale e processo di copia degli asset, verificandone la presenza in build.
2. Introdurre adapter e coda con test unitari prima di collegarli allo stato React.
3. Esporre il feed locale di consegne e integrare il singolo overlay con board normale/fullscreen.
4. Aggiornare la documentazione routed per architettura frontend, interazione board, contratto dei dadi e gestione degli asset.
5. Eseguire test, build, controllo documentazione, validazione OpenSpec e scenari manuali prima di considerare completa la change.

Il rollback rimuove overlay, feed locale, dipendenza e asset. Poiché non sono previsti cambi di schema, endpoint o snapshot, i log P0.6a e il comportamento numerico restano compatibili e non richiedono migrazioni inverse.
