# Design

## Context

Per la motivazione vedere `proposal.md`. `SceneCatalogPanel` possiede indice del passaggio, preview comune, guardia di uscita e registro delle bozze. Oggi `SceneEncounterSection` possiede la selezione dell'encounter, il form dell'incontro e i due editor figli per figure e placement. Dopo una creazione riuscita chiama `choose(null)`, lasciando i figli nascosti. Il riepilogo e `continueStep` assumono che l'ultimo indice sia 4; anche il verificatore browser naviga con questi indici.

Gli editor delle figure e dei placement ricevono già `scene` ed `encounterId` e filtrano i contenuti per tale identità. `useSceneDraft` registra salvataggio e scarto presso il wizard, ma il cambio dell'encounter attualmente azzera le bozze nei figli senza passare dalla guardia. La preview dei placement è un portal: nascondere soltanto il pannello dei form non basta a disabilitarne l'interazione.

## Goals / Non-Goals

**Goals:** un solo proprietario per la selezione delle figure nella scena, riuso dei form e delle API esistenti, guardie coerenti per cambio encounter e navigazione, separazione effettiva dell'interazione nella preview.

**Non-Goals:** nuove sorgenti di creature, importazioni, cambi alle schede, nuove route, migrazioni, modifica di permessi o del runtime dei token. Movimento e tab Personaggi restano fuori da questo change.

## Decisions

1. **Separare incontro e figure nella composizione del wizard.** `SceneEncounterSection` mantiene il CRUD degli incontri. Un componente dedicato al passaggio Mostri e PNG contiene il selettore e riusa `SceneEncounterEntitySection` e `SceneEncounterPlacementSection`. Mantenere tutto nel componente attuale con numerosi flag renderebbe meno chiari gli editor disponibili e aumenterebbe il rischio che il portal rimanga attivo nel passaggio sbagliato.

2. **Selezione esplicita e locale alla scena.** Il wizard conserva l'ID scelto per Mostri e PNG, distinto dalla selezione del form di modifica encounter. Il valore iniziale è vuoto, anche dopo una creazione; un selettore nominato mostra gli incontri salvati. La selezione sopravvive al cambio passaggio nella stessa scena, si azzera al cambio scena ed è rivalidata sul dettaglio autorevole. Non aggiungere la selezione allo snapshot o al documento persistito. Scegliere automaticamente il primo encounter sarebbe ambiguo nelle scene che ne contengono più di uno.

3. **Risolvere le bozze prima di cambiare destinatario.** Il selettore passa dalla guardia `leave` già presente. Le callback registrate salvano usando l'encounter originale; solo dopo un successo completo cambia l'ID. Restare non smonta gli editor; scartare ne ripristina le bozze prima del cambio. Un rifiuto o conflitto non esegue la navigazione. Le versioni delle scritture continuano a essere lette da `useSceneCatalog` al momento dell'esecuzione, senza riusare una versione catturata prima del primo salvataggio.

4. **Rendere espliciti i sei passaggi in tutti i punti di navigazione.** Aggiornare etichette, contenuto, riepilogo, condizioni di interattività e comandi avanti/indietro. Derivare il limite dall'elenco dei passaggi per evitare un nuovo indice finale duplicato. Il conteggio delle figure comprende solo i riferimenti monster/npc degli encounter; le istanze sono contate dai placement. Conservare il focus sul titolo dopo la navigazione.

5. **Conservare i contratti dati attuali.** Tutte le operazioni restano quelle versionate di `useSceneCatalog`; il nuovo step riceve il medesimo dettaglio scena. I controlli di collocazione sono interattivi solo nel nuovo passaggio con un encounter valido. Uscita e cambio contesto annullano il gesto incompleto. Le schede e il comando quantità vengono riutilizzati senza una seconda pipeline.

## Risks / Trade-offs

- [Bozza salvata nell'incontro sbagliato] → eseguire la guardia prima del cambio ID e testare salvataggio/scarto/permanenza con due encounter.
- [Portal attivo fuori dal nuovo passaggio] → governare esplicitamente `preview.interactive` e cancellare il gesto quando diventa falso; verificare che Encounter non abbia target di collocazione.
- [Selezione rimasta valida solo nella versione precedente] → rivalidare l'ID dopo ogni risposta autorevole, inclusi conflitti e cambio scena.
- [Regressione nella navigazione esistente] → aggiornare gli indici del verificatore browser e provare accesso diretto, avanti/indietro, riepilogo, chiusura, scena senza encounter e finestra stretta.
- [Salvataggi multipli con versione obsoleta] → mantenere il registro e la coda esistenti, verificando che una bozza figura e una bozza placement vengano salvate in sequenza sul dettaglio aggiornato.

## Migration Plan

Non servono conversioni dei dati: il nuovo frontend legge incontri, figure e collocazioni già salvati. Dopo la verifica, distribuire la normale build; un rollback del frontend ripristina l'organizzazione in cinque passaggi usando gli stessi documenti. Le specifiche canoniche vengono sincronizzate soltanto dopo implementazione e verifica, in fase di archivio.
