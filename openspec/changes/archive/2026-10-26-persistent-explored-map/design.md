## Context

La visione corrente è calcolata nel frontend a partire dal PG, dalle luci e dai blockers. Il buio segue la scena, il Master conserva la visione gestionale e le scene inattive non sono consegnate ai Player. I percorsi accettati sono disponibili sul server; gli eventi token-walk sono effimeri e non possono essere la fonte di una memoria persistente.

## Goals / Non-Goals

Il terreno visto lungo un corridoio resta visibile tornando indietro. Nessuna automazione di luci, nessun nuovo account o sorgente luminosa. Non realizzare in questo change tutta la futura P0.10: la memoria non rende segreti dati già consegnati dal modello attuale, ma non deve introdurre nuove rivelazioni attraverso la presentazione o i nuovi payload.

## Decisions

1. Memoria condivisa per campagna/scena, con identità stabile della scena. Ogni PG canonico del party presente nella scena contribuisce con le regioni effettivamente visibili secondo le regole correnti di raggio, scurovisione, luci e ostacoli. Nemici, familiari, preview del Master e PG di scene inattive non sono sorgenti aggiuntive. In un veicolo usare la posizione effettiva del PG trasportato.
2. Separare terreno esplorato, visuale corrente e flag luce completa. La maschera del terreno rivela l'unione di memoria e visuale corrente; dove entrambe mancano resta #000 opaco. La memoria è mostrata alla normale visibilità del terreno, senza un velo scuro che contraddica la richiesta di rimanere visibile. I token dinamici continuano a usare visuale attuale e sanitizzazione, non l'unione delle regioni esplorate.
3. Calcolo autorevole su posizioni/percorso accettati, mai su coordinate o regioni arbitrarie del client. Estrarre la geometria riutilizzabile in un modulo ESM condiviso senza cambiare il significato dei calcoli. Unire le regioni visibili a ogni passo del percorso accettato; per riposizionamenti diretti/trasferimenti senza percorso rivelare soltanto l'arrivo, senza inventare un corridoio fra partenza e destinazione. Preview, movimenti rifiutati e animazioni locali non esplorano. L'undo del movimento non cancella conoscenza acquisita.
4. Considerare la regione visibile corrente anche al login/attivazione, dopo una modifica pertinente a luce o blockers e dopo movimento del veicolo; accumulare soltanto visione legittima. Non marcare tutta la scena come esplorata solo perché il Master attiva temporaneamente la luce completa o osserva la mappa. Con luce completa attiva sospendere l'accumulo indiscriminato; quando torna il buio usare la memoria precedentemente acquisita e la visuale ora consentita.
5. Rappresentazione sparsa in coordinate mondo, indipendente da camera/zoom/pixel dell'immagine. Valutare intervalli di celle o chunk con maschere, mantenendo precisione compatibile con i confini della maschera attuale: non rivelare una cella intera oltre un muro perché ne è visibile un solo angolo. Unione idempotente e monotona, nessuna matrice proporzionale a una board illimitata. Dimensionare i payload e inviare delta soltanto quando la memoria cresce; non tagliare memoria vecchia per imporre un limite nascosto.
6. Nuova persistenza SQLite per memoria scena/campagna e revisione, separata da documento di preparazione e snapshot runtime. Migrazione additiva e backfill vuoto per scene legacy, senza sovrascrivere migrazioni applicate. Commit di movimento e aggiornamento memoria devono essere coordinati: persistere prima di pubblicare il successo, nessun movimento accettato seguito da memoria non salvata dichiarata come persistita. Gli errori lasciano invariati posizione e memoria e sono segnalati al chiamante; nessun evento effimero anticipato. L'incremento memoria non crea conflitti spuri con la versione del documento scena.
7. SSE e HTTP consegnano ai Player soltanto memoria della scena attiva, con sceneId e revisione. Merge concorrenti tramite unione, eventi duplicati/stale innocui; una riconnessione recupera lo stato completo. Bloccare patch dirette dei Player e full-state master legacy che tentino di sostituire/azzerare la memoria per errore: il servizio ne resta proprietario. Alla transizione mantenere memoria per entrambe le scene e ignorare delta ritardati della sorgente.
8. Restore di snapshot vecchi e undo non fanno tornare indietro la memoria persistita; la memoria mancante parte vuota e riceve solo la visuale legittima corrente. Non migrare o persistere l'intero runtime multi-scena. Nessun reset manuale aggiuntivo è richiesto da questa proposta. Le modifiche di calibrazione dell'immagine non traslano le coordinate mondo della memoria.

## Risks

Riempimento per celle troppo grossolano può mostrare parti oltre un ostacolo; verificare bordi e angoli con la maschera SVG. Scrivere una regione a ogni frame è costoso: elaborare percorsi confermati e unioni compatte, non l'animazione. Un evento di camminata perso non può cancellare esplorazione. Le semantiche correnti di visibilità dei token devono restare separate dalla nuova maschera del terreno.

## Documentation impact

Aggiornare durante Apply i contratti frontend di visione e architettura, gameplay movimento/identità, backend stato/persistenza e API/SSE, database e operazioni. I documenti correnti restano descrizioni dell'implementazione attuale finché il change non viene applicato. Canonici OpenSpec sincronizzati soltanto dopo verifica, non durante la proposta.

## Verification

Geometria deterministica e unioni, percorso A→B→A, pareti/angoli, nessuna visione aggiuntiva dei nemici, due Player e Master, movimenti concorrenti, scena attiva/inattiva, reload/riavvio e SQLite in errore. Build e test oltre a strict validation; controllo visivo necessario per verificare l'opacità effettiva e la continuità del corridoio.

## Aggiornamenti richiesti: muri e bordi
Integrare [freehand-vision-walls](../2026-10-26-freehand-vision-walls/proposal.md) fra gli occlusori usati per la visuale e l'accumulo autorevole. Integrare [soft-darkness-edges](../2026-10-26-soft-darkness-edges/proposal.md) come fascia locale sul bordo rivelato, senza un velo su tutta l'area esplorata e senza espandere la memoria. Un muro nuovo non cancella il terreno ricordato, ma limita visuale live e nuove scoperte.
