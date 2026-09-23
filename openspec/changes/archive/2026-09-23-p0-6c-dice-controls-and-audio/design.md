## Context

Vedi `proposal.md` per la motivazione. P0.6b concentra la scena, la coda FIFO e l'interruzione tecnica del tiro in `Dice3DOverlay`, mentre `App` compone sia l'overlay sia `DicePanel`. La scena è intenzionalmente `pointer-events: none`; il log è già autorevole e immediato, quindi salto, preferenze e audio devono restare effetti locali che non mutano `BattleMapSharedState`.

Il renderer è fissato a `@3d-dice/dice-box-threejs@0.0.12`. Il pacchetto contiene campioni audio, ma il suo caricamento sonoro è accoppiato all'inizializzazione della scena e non espone un ciclo pubblico affidabile per abilitarlo dopo che un renderer silenzioso è già nato. I browser, inoltre, possono rifiutare `play()` prima di un'attivazione dell'utente. Il processo di build corrente copia soltanto le texture in `public/dice-box`.

## Goals / Non-Goals

**Goals:**

- mantenere preferenze e consenso implicito all'audio interamente locali al browser;
- usare un unico percorso d'interruzione per click, `Esc`, cambio preferenza e movimento ridotto;
- distinguere il salto del tiro corrente dallo svuotamento dei tiri pendenti richiesto quando l'animazione viene disabilitata;
- isolare ogni errore audio dalla scena, dalla coda e dal log;
- rendere asset, comportamento e test riproducibili senza rete in esecuzione.

**Non-Goals:**

- sincronizzare l'audio fra client o registrarlo nello snapshot;
- riprodurre audio per tiri non consegnati o per la cronologia usata come baseline;
- offrire volume continuo, scelta dei campioni, temi sonori o personalizzazioni per dado;
- cambiare fisica, durata, autorità, visibilità o risultato dei tiri;
- introdurre dadi karmici o preferenze condivise dal Master.

## Decisions

### 1. Preferenze possedute da un hook locale e composte in `App`

Un hook dedicato leggerà e scriverà un singolo record versionato in `localStorage`, con due booleani: animazione e audio. Valori mancanti, malformati o di versione sconosciuta useranno i default compatibili `animationEnabled: true` e `soundEnabled: true`; il vincolo di movimento ridotto continuerà a prevalere sull'animazione senza riscrivere la scelta dell'utente.

`App` possiederà il valore del hook e passerà lo stesso snapshot a `DicePanel` per i controlli e a `Dice3DOverlay` per l'esecuzione. Questo evita due sorgenti locali divergenti fra componenti fratelli. Salvare le preferenze nel server o in `useBattleMapState` è scartato perché trasformerebbe una scelta personale in un contratto condiviso, con normalizzazione, autorizzazione e SSE non necessari.

I due interruttori saranno collocati nel dock dei dadi, vicino all'azione che influenzano, con etichette testuali e stato `checked`; l'audio resterà configurabile anche quando l'animazione è spenta, ma verrà applicato soltanto a una futura animazione abilitata. Una nuova tab globale delle impostazioni è scartata perché aumenterebbe navigazione e superficie UI per due sole preferenze.

### 2. Salto osservato a livello documento senza intercettare l'azione originale

Solo mentre una presentazione è nello stato `rolling` o `settled`, l'overlay registrerà listener per `click` primario e `keydown` con `Escape`. I listener invocano la stessa funzione idempotente già usata per interrompere la Promise corrente e ripulire il renderer, ma non chiamano `preventDefault`, `stopPropagation` o `focus`; il controllo cliccato e le altre semantiche di `Esc` restano quindi operative.

Il click che avvia un tiro non può saltarlo perché avviene prima che la consegna autorevole renda attiva la presentazione. Click secondari e semplici movimenti del puntatore non producono il salto. Rendere cliccabile l'overlay è scartato perché violerebbe la trasparenza agli eventi della board; aggiungere un pulsante focalizzabile sopra la scena è scartato perché sottrarrebbe focus e duplicherbbe il comando da tastiera.

### 3. La coda distingue `abortCurrent` da `discardPending`

Il comando di salto termina soltanto l'elemento corrente: il ciclo FIFO riparte naturalmente dal successivo. Quando invece l'utente disabilita l'animazione, il controller interrompe il tiro corrente e scarta gli elementi già pendenti; i loro id restano deduplicati e non verranno ripresentati se la preferenza viene riattivata subito dopo. I nuovi elementi ricevuti mentre la preferenza è spenta vengono ugualmente considerati gestiti e degradano al log numerico.

Questa distinzione evita che una preferenza disabilitata per pochi istanti faccia partire più tardi una coda precedente. Ricreare la coda al cambio di preferenza è scartato perché perderebbe esplicitamente lo stato di deduplica.

### 4. Gesto utente tracciato una volta, senza prompt o playback retroattivo

Il client considera sbloccato l'audio dopo il primo `pointerdown` o `keydown` attendibile osservato nella pagina. I listener sono rimossi dopo l'attivazione e non persistono il gesto: dopo un nuovo caricamento il browser viene trattato di nuovo come bloccato. Un tiro precedente al gesto resta silenzioso; il gesto aggiorna soltanto l'abilitazione dei tiri futuri.

Non verranno mostrati prompt, toast o tentativi automatici ripetuti. Usare il semplice caricamento della pagina come consenso è scartato perché non soddisfa le policy di autoplay; interpretare il toggle audio stesso come unica attivazione è scartato perché anche i normali click e comandi da tastiera sono gesti validi.

### 5. Controller audio separato dal renderer, alimentato dagli asset della dipendenza

Un piccolo adapter browser riprodurrà durante il tiro una breve sequenza di campioni `dicehit` e `surface` forniti dal pacchetto e serviti da `/dice-box/sounds`. L'adapter nasce soltanto dopo il gesto utente, cattura e ignora i rifiuti di `HTMLMediaElement.play()`, e può fermare clip e timer quando il tiro viene saltato o l'audio viene disabilitato. La sequenza è decorativa e non tenta di dedurre valori o modificare i tempi della Promise del renderer.

Separare l'audio permette alla scena di inizializzarsi e funzionare anche se uno o tutti i file sonori mancano o il browser nega la riproduzione. Abilitare direttamente `sounds` nella libreria è scartato: carica numerosi file nel percorso critico della scena, lega un guasto audio al renderer e non offre un'API pubblica stabile per il passaggio silenzioso/sonoro dopo l'inizializzazione. Inventare nuovi campioni è scartato perché la dipendenza già fornisce asset coerenti e licenziati.

Lo script degli asset copierà sia `textures/` sia `sounds/` dalla versione fissata, ricreando deterministicamente la destinazione prima della copia. La build continuerà a essere autosufficiente e non userà CDN.

### 6. Logica pura testabile, browser verificato manualmente dove necessario

Parsing e serializzazione delle preferenze, transizioni della coda e decisione `canPlayDiceSound` saranno funzioni o controller privi di DOM coperti dai test Node esistenti. I test verificheranno default e dati corrotti, persistenza, deduplica dopo lo scarto, salto del solo elemento corrente e isolamento degli errori audio mediante dipendenze iniettate.

La propagazione reale di click/`Esc`, il mantenimento del focus, le restrizioni autoplay e la resa acustica richiedono verifica manuale nel browser; non verrà introdotto un runner DOM soltanto per questa change. `npm run build` verificherà tipi, integrazione React e presenza degli asset, mentre `npm run docs:check` coprirà gli aggiornamenti ai contratti routed.

## Risks / Trade-offs

- [Un click destinato a un controllo salta anche il tiro] → è il comportamento richiesto; il listener non consuma l'evento, quindi l'azione primaria continua normalmente.
- [Più listener globali possono interferire con modali o scheda] → registrarli soltanto durante la presentazione e non prevenire né fermare gli eventi.
- [Una preferenza corrotta può bloccare stabilmente l'esperienza] → validazione stretta del record e ritorno atomico ai default.
- [I browser applicano policy audio differenti] → richiedere un gesto reale, gestire ogni `play()` come fallibile e mantenere sempre indipendenti animazione e log.
- [La sequenza audio separata non coincide con ogni collisione fisica] → privilegiare isolamento e stabilità dell'API; sincronizzarla all'inizio e alla conclusione della presentazione senza attribuirle significato di gioco.
- [Gli asset sonori aumentano il peso statico] → copiare soltanto le directory e i campioni effettivamente referenziati dall'adapter, documentando l'elenco nel tool riproducibile.

## Migration Plan

1. Aggiungere parser, storage e test delle preferenze mantenendo attivi i default correnti.
2. Estendere coda e overlay con le due forme d'interruzione e i test di regressione FIFO/deduplica.
3. Esporre i controlli nel dock e collegare le preferenze condivise localmente fra pannello e overlay.
4. Copiare gli asset sonori selezionati e integrare l'adapter audio dopo il gate di interazione.
5. Aggiornare la documentazione routed e verificare test, build, asset, focus, click, `Esc`, persistenza e autoplay con almeno due client.

Il rollback rimuove hook, controlli e adapter audio e ripristina lo script alle sole texture. Le chiavi locali residue vengono ignorate dal codice precedente; nessuno snapshot o dato server richiede migrazione inversa.
