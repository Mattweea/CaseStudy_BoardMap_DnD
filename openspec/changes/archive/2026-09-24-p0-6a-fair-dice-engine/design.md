## Context

Come descritto in [proposal.md](./proposal.md), il server genera oggi dadi in due percorsi separati tramite resto modulo, mentre il browser possiede già una terza implementazione con rejection sampling. Il server resta l'unica autorità per i tiri condivisi; snapshot e client esistenti dipendono dai campi aggregati `rolls`, `keptRolls`, `parts` e `total`. La futura presentazione 3D deve poter distinguere dadi con lo stesso valore e gruppi differenti senza ricostruire semantica dai soli array numerici.

Il repository usa già moduli ESM JavaScript condivisi con dichiarazioni TypeScript in `shared/`, importati sia dal server sia dal bundle Vite. Lo stato condiviso viene normalizzato al caricamento, filtrato per destinatario prima di HTTP/SSE e distribuito come snapshot versionato.

## Goals / Non-Goals

**Goals:**

- eliminare il modulo bias con un solo algoritmo condiviso e una sola porta di tiro;
- separare l'algoritmo puro dalla sorgente di entropia specifica del runtime;
- produrre identità e semantica per-dado stabili per tutta la vita di una voce di log;
- mantenere leggibili snapshot e consumatori precedenti;
- rendere i controlli matematici ripetibili e non flaky.

**Non-Goals:**

- decidere la libreria o il ciclo di vita della scena 3D;
- convertire il d100 logico nei due dadi percentile visivi;
- introdurre un nuovo evento SSE o cambiare l'ordine di pubblicazione del log;
- rendere autorevole l'animazione o il tiro di iniziativa locale preesistente;
- implementare commit-reveal, dadi karmici o persistenza di seed.

## Decisions

### 1. Modulo ESM condiviso, entropia iniettata dagli adapter di runtime

Un nuovo modulo dependency-free in `shared/`, corredato dalla dichiarazione `.d.ts`, esporrà una porta di alto livello per risolvere un tiro e funzioni pure per i modelli probabilistici. Il modulo riceverà una funzione `nextUint32`; l'adapter server la alimenterà con `node:crypto`, mentre il wrapper browser esistente userà `crypto.getRandomValues`. Il resolver della scheda e il tiro libero chiameranno la stessa porta invece di applicare direttamente `% sides`.

Il rejection sampling userà `limit = 2^32 - (2^32 mod S)` e accetterà soltanto valori minori di `limit`. La sorgente deterministica sarà disponibile soltanto ai test tramite dependency injection e non farà parte dei payload applicativi.

Alternative considerate:

- mantenere implementazioni parallele corrette: escluso perché continuerebbe a consentire divergenze;
- importare `node:crypto` nel modulo condiviso: escluso perché renderebbe il modulo non utilizzabile nel browser;
- usare un generatore pseudocasuale con seed in produzione: escluso perché ridurrebbe la qualità dell'entropia e introdurrebbe un segreto da gestire.

### 2. Contratto additivo `dice` al livello della voce di log

Il risultato del motore e `DiceRollLog` aggiungeranno:

```ts
type DieDisposition = 'kept' | 'discarded' | 'unresolved';

interface RolledDie {
  id: string;
  sides: 4 | 6 | 8 | 10 | 12 | 20 | 100;
  value: number;
  groupId: string;
  disposition: DieDisposition;
}
```

`dice` conterrà tutti i dadi della voce, inclusi tutti i blocchi di danno; `groupId` collegherà ogni dado al gruppo logico senza obbligare il renderer a interpretare `parts`. Gli identificatori saranno creati una volta durante la risoluzione e poi conservati invariati in risposta, stato e SSE. Il formato esatto degli id e dei group id è opaco ai consumatori; devono essere univoci rispettivamente nel tiro e nel relativo insieme di gruppi.

I campi aggregati correnti non saranno derivati nuovamente durante la lettura: restano parte del contratto compatibile e vengono prodotti insieme a `dice`. La normalizzazione accetterà `dice` assente per gli snapshot legacy e conserverà soltanto una lista nuova interamente valida; non sintetizzerà id o disposizioni, perché una ricostruzione non potrebbe distinguere correttamente parità e gruppi storici.

Alternative considerate:

- aggiungere solo indici a `rolls`: insufficiente per gruppi di danno e semantica kept/discarded;
- annidare i dadi esclusivamente in `parts`: non copre in modo uniforme tiri semplici e coppie d20;
- sostituire i campi legacy: escluso perché romperebbe UI e snapshot esistenti.

### 3. Selezione deterministica in parità e coppie della scheda irrisolte

Per vantaggio e svantaggio il motore sceglierà per indice: confronterà i valori e, in parità, terrà il primo dado. In questo modo esistono sempre esattamente un `kept` e un `discarded`, anche quando cercare il valore tenuto negli array sarebbe ambiguo.

Le coppie d20 della scheda non sono vantaggio/svantaggio secondo la capability corrente: entrambe saranno `unresolved`. Per compatibilità, `keptRolls` e `total` continueranno a rappresentare il primo tiro, ma P0.6b dovrà usare `disposition` e non inferire che quel campo legacy costituisca una scelta del server.

Alternative considerate:

- marcare entrambi i dadi della scheda `kept`: escluso perché suggerirebbe che entrambi contribuiscono allo stesso totale;
- aggiungere una quarta disposizione specifica della scheda: escluso perché `unresolved` esprime la semantica senza legare il motore a un'origine UI.

### 4. Il d100 resta un dado di dominio, l'adapter 3D lo espanderà

Il motore registra `sides: 100` e un valore `1..100`. P0.6b convertirà questo risultato nei modelli decine e unità richiesti dal renderer, compresi i casi limite 100 e multipli di dieci. Tale conversione non appartiene né al calcolo del totale né al formato persistito.

Alternative considerate:

- generare d10 e dado delle decine già nel motore: escluso perché cambia il numero di variabili casuali e trasferisce una convenzione grafica nel dominio;
- salvare direttamente la notazione specifica della libreria 3D: escluso per non accoppiare stato e provider di rendering.

### 5. Verifica statistica deterministica affiancata da test esatti

I test più importanti controlleranno esattamente il rejection sampling con sequenze iniettate ai limiti e confronteranno aggregati e disposizioni con casi noti. Una PRNG deterministica, definita soltanto nel codice di test con seed fisso, produrrà inoltre campioni dichiarati per ogni dado supportato e per vantaggio/svantaggio.

La suite userà almeno 200.000 osservazioni per distribuzione, richiederà tutte le facce, confronterà media entro cinque errori standard e varianza entro una tolleranza relativa del 2%, e applicherà un test chi-quadro con soglia di significatività `0,001`. Vantaggio e svantaggio saranno confrontati con le rispettive 20 probabilità chiuse; successo contro CD e critico saranno coperti con casi esatti e limiti 0/1. Poiché sorgente, campione e soglie sono fissi, un fallimento è riproducibile. Questi test verificano trasformazione e modello, non certificano la qualità statistica del sistema operativo.

Alternative considerate:

- campionare il CSPRNG reale nei test: escluso perché renderebbe la suite non deterministica;
- affidarsi soltanto al chi-quadro: escluso perché non isola errori su limiti, aggregazione e selezione.

## Risks / Trade-offs

- [Il doppio formato può divergere] → il motore produrrà in una sola operazione dettaglio e aggregati; i test confronteranno `dice`, `rolls`, `keptRolls`, `parts` e `total` per ogni modalità.
- [Snapshot legacy senza `dice` non sono animabili in futuro] → restano leggibili ma non vengono arricchiti con semantica inventata; P0.6b degraderà al risultato numerico.
- [Una lista `dice` malformata potrebbe attraversare il ripristino] → la normalizzazione la elimina come unità senza scartare un log legacy altrimenti valido.
- [I test statistici aumentano il tempo della suite] → campioni fissi e implementazione sincrona mantengono il costo limitato; i test esatti restano la diagnosi primaria.
- [Il wrapper browser può essere scambiato per autorità] → documentazione e nomi distinguono gli usi locali; HTTP/SSE continuano ad accettare soltanto richieste e mai risultati client.

## Migration Plan

1. Introdurre motore condiviso, tipi e test senza cambiare i payload correnti.
2. Migrare il tiro libero e il resolver della scheda alla stessa porta, verificando formule, side effect, autorizzazione e privacy.
3. Aggiungere `dice` ai nuovi log e la normalizzazione tollerante degli snapshot legacy.
4. Aggiornare i wrapper client e la documentazione instradata; eseguire test, build, controlli documentali e validazione OpenSpec.

Il rollback può ripristinare i due chiamanti e omettere il campo additivo senza migrazioni di database. Gli snapshot scritti durante la change rimangono leggibili dal codice precedente perché i campi sconosciuti sono additivi e quelli legacy restano presenti.
