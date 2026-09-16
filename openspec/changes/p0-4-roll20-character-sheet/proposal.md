## Why

Il roster e la superficie di sessione esistono, ma i Player non hanno ancora una scheda persistente da consultare e aggiornare durante il gioco. P0.4 introduce la parte centrale del flusso VTT: una scheda in stile Roll20, basata sui contenuti del PDF 5e, modificabile in tempo reale senza importazioni esterne.

## What Changes

- Aggiungere una finestra scheda aperta dalla tab Personaggi, flottante e trascinabile sopra la sessione, con la proporzione compatta della finestra personaggio di Roll20, larghezza contenuta e sviluppo interno prevalentemente verticale, senza oscurare o bloccare l'intero workspace. La finestra sarà organizzata nelle tre aree del PDF: Personaggio e combattimento, Aspetto e storia, Incantesimi. La resa grafica riprenderà la gerarchia e il linguaggio visivo del PDF di riferimento e della reference Roll20: foglio chiaro, cornici scure, pannelli grigio chiaro, riquadri sagomati, etichette compatte e composizione densa a colonne, adattati al web e all'accessibilità.
- Inizializzare una sola scheda attiva per ciascun `adventurer` nella campagna locale e rendere tutti i valori manualmente modificabili, incluse collezioni ripetibili per attacchi, equipaggiamento, strumenti, linguaggi, privilegi, sezioni di risorse e incantesimi. La tab Personaggio si dispone su tre colonne di uguale larghezza sotto un'intestazione a piena larghezza; non prevede una sezione Azioni né la moneta Electrum.
- Consentire come unico upload il ritratto JPEG, PNG o WebP fino a 5 MB, sostituibile dal proprietario e visibile nella scheda e nel roster. Non importare PDF, JSON, schede esterne o allegati generici e non cambiare automaticamente l'immagine del token.
- Consentire al proprietario e al Master di leggere e modificare la scheda completa; gli altri Player continuano a ricevere solo i dati pubblici del roster.
- Sincronizzare ogni patch accettata nello stato live e via SSE, con controllo di versione e gestione dei conflitti. Raggruppare le scritture SQLite con debounce di circa un secondo e forzarle nei punti di chiusura, mostrando chiaramente lo stato di salvataggio.
- Collegare al token nome, HP, velocità e modificatore di iniziativa attraverso una mappatura esplicita, lasciando ritratto e CA nella scheda.

## Capabilities

### New Capabilities

- `character-sheet-management`: ciclo di vita, campi a tre tab, permessi, ritratto e collegamento controllato al token.
- `character-sheet-live-sync`: patch concorrenti, aggiornamenti SSE, stato di salvataggio e persistenza SQLite raggruppata.

### Modified Capabilities

- `session-workspace`: la tab Personaggi apre ora la scheda autorizzata e mostra il ritratto aggiornato, mantenendo la localizzazione del token.

## Impact

Sono interessati la tab Personaggi e il contenitore della sessione in `src/App.tsx`, nuovi componenti, token grafici e stili della scheda, un hook/client API dedicato, le API e lo stream SSE Fastify, repository/policy/service server, lo schema SQLite tramite nuove migrazioni e una directory locale gestita per i ritratti. Sarà necessaria una gestione multipart o equivalente per l'upload; le migrazioni P0.1 già applicate non verranno modificate.
