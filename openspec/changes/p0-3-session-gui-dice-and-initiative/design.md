## Context

Si veda `proposal.md` per la motivazione e le tre delta spec per il comportamento atteso. Oggi `src/App.tsx` compone una sidebar sinistra con sette sezioni Master o cinque Player; `src/styles/index.css` le assegna 280–340 px e sposta la mappa a destra. `DicePanel.tsx` calcola nel browser e invia un `DiceRollLog` già completo a `POST /api/battle-map/dice-logs`. Il server conserva gli ultimi 30 log nello stato condiviso in memoria. `nextSnapshot(user)` filtra i token invisibili, ma non i dadi; alcuni handler restituiscono inoltre `nextSnapshot()` senza utente. Il tracker e il round esistono già; non esiste una scheda personale.

## Goals / Non-Goals

**Goals:** stabilire una struttura UI che accoglierà le schede e la chat future senza cambiarne l'architettura; usare un'unica strada autorevole per tiri da controlli a click e da comando; assicurare che nessuna proiezione HTTP/SSE o anteprima riveli tiri segreti; produrre avvisi di turno da transizioni effettive, senza duplicati per snapshot ripetuti.

**Non-Goals:** salvare automaticamente il log o le sessioni di login dopo riavvio (P0.10); introdurre chat testuale (P2.6); creare o tirare dalla scheda (P0.4/P0.5); cambiare l'inserimento o il calcolo dell'iniziativa (P0.7).

## Decisions

### Pannello destro come contenitore, strumenti di mappa indipendenti

Riorganizzare `App.tsx` in una superficie mappa a sinistra e un pannello destro a quattro tab. Portare log, tracker, roster e legenda nei rispettivi contenuti; collocare i controlli dadi a click e l'input dei comandi in una sezione inferiore stabile del pannello, raggiungibile da tutte le tab. La tab Chat + Dadi mostra il log nella parte sopra questa sezione, riservando lì lo spazio per la chat futura. Conservare i controlli Master di sessione, azioni e luce in una barra o area strumenti contestuale raggiungibile, senza aggiungere tab principali; mantenere i permessi esistenti. La tab Personaggi usa `CHARACTER_PROFILES` e i token visibili già ricevuti, presentando la localizzazione soltanto dove il token esiste. Il pannello è una colonna da circa 25% su desktop e un overlay chiudibile su viewport stretti; apertura, chiusura e tab usano controlli con focus e stato accessibile.

Lasciare `Board.tsx` responsabile dei pulsanti di zoom `+`/`−` già presenti e delle interazioni pointer attuali: Ctrl+trascinamento o tasto centrale per muovere la visuale e trascinamento dei token autorizzati. Il nuovo contenitore deve ridimensionare la board senza sovrapporre il pannello ai controlli o cambiare le coordinate della mappa. La riorganizzazione non modifica le regole di movimento previste più avanti in P0.6.

Alternativa scartata: rinominare la sidebar attuale e lasciarla a sinistra. Non raggiunge la composizione della reference 1 e non prepara l'apertura della scheda dalla lista Personaggi.

### Contratto unico per i tiri liberi

Introdurre una richiesta autenticata di tiro (per esempio `POST /api/battle-map/rolls`) con formula normalizzata, visibilità e, se scelta dai controlli in basso, modalità normale/vantaggio/svantaggio. I controlli a click e il comando `/r` convertono l'input nella stessa richiesta; non inviano ID, autore, timestamp, dadi usciti o totale. I controlli dei dadi riprendono dalla reference 2 la scelta visiva del dado; il pulsante di tiro apre una modale compatta, centrata nella sola superficie della mappa con backdrop sulla stessa area, per impostare modificatore positivo o negativo, modalità e visibilità. Il parser accetta una forma limitata `NdS` con modificatore intero opzionale (`+M`/`-M`), dadi già supportati d4/d6/d8/d10/d12/d20/d100 e limiti espliciti su quantità e modificatore. Il server valida prima di tirare, usa generazione casuale sicura e compone il log autorevole. Vantaggio/svantaggio mantengono il comportamento attuale del d20 e non alterano la sintassi base `/r`.

Alternativa scartata: riutilizzare `POST /dice-logs` accettando il `DiceRollLog` del client. Un client potrebbe scegliere il risultato o impersonare l'autore. Il vecchio endpoint va eliminato o reso incapace di creare log arbitrari durante la migrazione del frontend.

### Log server-owned e proiezione per destinatario

Il log dei tiri conserva `authorUserId` e `visibility` accanto ai campi mostrati. Lo stato canonico sul server può tenere i 30 tiri in memoria fino a P0.10, ma le mutazioni generiche della mappa, l'undo e gli snapshot importati non devono poter sostituire i log server-owned con dati del client. `sanitizeStateForUser` filtra sia `diceLogs` sia `latestDicePreview`; tutte le risposte di mutazione, gli errori con snapshot, lo stato iniziale e lo stream SSE passano da una proiezione con l'utente autenticato. Per un tiro segreto, l'eventuale anteprima è destinata solo all'autore e al Master. L'azione di pulizia log deve seguire una policy esplicita e non permettere a un Player di eliminare indiscriminatamente i tiri altrui.

Alternativa scartata: nascondere soltanto la riga del log nel frontend. I dati rimarrebbero leggibili nelle risposte HTTP e negli eventi SSE. La separazione server-owned evita anche che un `PUT /state` con una vista filtrata cancelli tiri segreti.

### Avvisi di turno derivati dallo stato canonico

Il tracker legge l'ordine esistente e mostra turno/round. Per gli avvisi, il server calcola per ciascun Player se il proprio token è il successivo nel vero ordine canonico o è quello attivo, evitando deduzioni scorrette quando un token non è visibile. Associare al cambio turno un identificatore monotono di transizione; il client confronta l'ultimo identificatore osservato e mostra la modale appropriata una sola volta. Lo snapshot iniziale stabilisce il riferimento senza aprire una modale retroattiva. L'avviso contiene solo il messaggio pertinente e non rivela token nascosti. Le modali sono chiudibili e gestiscono il focus.

Alternativa scartata: dedurre il turno successivo dal tracker già filtrato e mostrare la modale a ogni aggiornamento SSE. La vista filtrata può omettere un nemico nascosto e gli snapshot non legati al combattimento ripeterebbero l'avviso.

## Risks / Trade-offs

- [Dati segreti in percorsi secondari] → verificare `GET /state`, SSE, risposte di mutazione, conflitti, preview, undo, suspend/resume e payload del vecchio endpoint con due sessioni Player e una Master.
- [Riorganizzazione UI nasconde controlli esistenti] → inventariare le sezioni correnti per ruolo e provarle dopo lo spostamento, anche su viewport stretto e con tastiera.
- [Nuovo layout interferisce con zoom e pointer della board] → provare pulsanti `+`/`−`, pan e trascinamento dei token con pannello aperto e chiuso, per Master e Player; mantenere i controlli di zoom dentro la superficie mappa.
- [Limiti del parser troppo permissivi o restrittivi] → documentare in legenda la grammatica e i limiti supportati; rifiutare formule non supportate con errore chiaro.
- [Avvisi ripetuti al refresh o omessi al giro di round] → usare un identificatore di transizione distinto dalla versione generale dello stato e inizializzare il riferimento all'apertura del client.

## Migration Plan

Aggiornare il frontend e il contratto server nello stesso change. Rendere il vecchio endpoint di log non scrivibile per i client, convertire le chiamate esistenti, quindi verificare che nessun percorso invii ancora log precompilati. Lo stato attuale è in memoria: i log già presenti senza autore affidabile o visibilità non vanno promossi a segreti; trattarli come pubblici durante la transizione o svuotarli all'avvio. In caso di rollback applicativo, tornare alla versione precedente senza migrazione dati; la persistenza del log appartiene a P0.10.
