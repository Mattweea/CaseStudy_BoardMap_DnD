## Why

P0.6a rende ogni dado autorevole, identificabile e semanticamente completo, ma il tiro continua a manifestarsi soltanto come una riga numerica nel log. La fase B deve trasformare quel risultato già deciso in un momento visivo sulla mappa, senza restituire autorità alla fisica del browser né bloccare le interazioni di gioco.

## What Changes

- Introduce una sovrapposizione 3D sulla superficie della mappa che anima ogni nuovo tiro visibile dotato del dettaglio per-dado di P0.6a, indipendentemente dal fatto che provenga dai controlli, da `/r`, dalla scheda o da un altro partecipante.
- Pilota `@3d-dice/dice-box-threejs` esclusivamente con esiti predeterminati dal server: il valore mostrato sulla faccia ferma deve coincidere con `DiceRollLog.dice`, mentre log, totale ed effetti collaterali restano immediati e indipendenti dall'animazione.
- Rappresenta formule con più dadi e gruppi di danno, distingue visivamente `kept` e `discarded` al termine del tiro e lascia entrambe le coppie `unresolved` sullo stesso piano.
- Traduce il d100 logico di P0.6a nella convenzione grafica percentile richiesta dal renderer senza alterare il contratto persistito o il totale.
- Serializza i tiri visibili in una coda locale, deduplica per id di log e non rianima la cronologia ricevuta al primo caricamento o dopo una riconnessione.
- Mantiene mappa, pannello e scheda interattivi durante il tiro; in assenza di WebGL, con `prefers-reduced-motion: reduce`, con dettaglio legacy assente/malformato o dopo un errore di inizializzazione mostra soltanto il risultato numerico già disponibile.
- Esclude da questa change preferenza personale persistente, comando di salto, audio, temi personalizzati e dadi karmici, destinati a P0.6c o a change successive.

## Capabilities

### New Capabilities

- `dice-3d-presentation`: animazione locale e non autorevole dei risultati per-dado visibili, coda, semantica delle disposizioni, fallback e compatibilità con i log legacy.

### Modified Capabilities

Nessuna. P0.6b consuma i risultati e le regole di visibilità esistenti senza cambiare il contratto dei tiri liberi o della scheda.

## Impact

La change interessa la composizione React attorno alla board, un nuovo componente/hook dedicato alla scena e alla coda, gli stili dell'overlay, i tipi locali della libreria, gli asset statici e la configurazione di build. Aggiunge `@3d-dice/dice-box-threejs` e le sue dipendenze ThreeJS/Cannon ES, senza nuovi endpoint, eventi SSE, campi condivisi o migrazioni. P0.6a è un prerequisito: i log senza `dice` degradano al comportamento numerico corrente.
