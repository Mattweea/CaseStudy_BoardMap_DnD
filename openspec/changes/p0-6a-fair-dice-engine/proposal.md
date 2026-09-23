## Why

I tiri liberi e quelli della scheda personaggio usano oggi implementazioni separate basate sul resto modulo, con una piccola distorsione statistica e il rischio che le regole divergano. Prima di introdurre la resa 3D di P0.6b serve inoltre un contratto server autorevole che identifichi ogni dado e ne descriva il ruolo nel risultato senza affidarsi al solo valore numerico.

## What Changes

- Introduce un unico motore di dadi equo e riusabile, con campionamento uniforme senza bias, sorgente crittografica in produzione e sorgenti deterministiche in test.
- Instrada nello stesso motore i tiri liberi e i tiri originati dalla scheda, senza modificare formule, autorizzazioni, visibilità, side effect o regole di selezione già previste.
- Estende in modo additivo i risultati autorevoli con la descrizione di ciascun dado: identità, numero di facce, valore, gruppo logico e disposizione `kept`, `discarded` oppure `unresolved`.
- Mantiene i campi esistenti (`rolls`, `keptRolls`, `parts`) per compatibilità con UI, snapshot e log correnti; un d100 resta un singolo dado logico con valore da 1 a 100, pronto per essere tradotto in due modelli percentile dalla futura presentazione 3D.
- Aggiunge verifiche deterministiche e statistiche per distribuzione, aggregazione e vantaggio/svantaggio.
- Esclude da questa change rendering WebGL, animazioni, nuovi eventi SSE, preferenze, audio, asset 3D e dadi karmici, che richiedono change successive.

## Capabilities

### New Capabilities

- `authoritative-dice-engine`: definisce uniformità, composizione dei risultati per-dado, modelli probabilistici verificabili e determinismo dei test del motore condiviso.

### Modified Capabilities

- `session-dice-rolling`: richiede che i tiri liberi autorevoli usino il motore equo e pubblichino il dettaglio additivo per-dado, preservando compatibilità e privacy.
- `character-sheet-roll-actions`: richiede che tutte le azioni di tiro della scheda usino lo stesso motore e descrivano esplicitamente dadi risolti e coppie d20 ancora da risolvere.

## Impact

La change interessa il motore condiviso delle regole, i resolver server dei tiri liberi e della scheda, i tipi e la normalizzazione client dei log, i test del dominio dadi e la documentazione instradata di gameplay, backend/realtime e frontend. Non introduce migrazioni dati, nuove dipendenze runtime o cambiamenti visivi; i payload esistenti restano leggibili grazie all'estensione additiva.
