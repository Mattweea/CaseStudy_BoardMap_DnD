## Context

`Board` mantiene camera e camminate locali. `viewportCells` include due celle di overscan: non descrive l'area davvero visibile. `viewportPixels` misura la shell meno il gutter degli assi. La correzione dello zoom presente nel workspace calcola lo zoom effettivo dalla larghezza; questo valore deve alimentare anche il seguito.

L'effetto esistente di `focusRequest` dipende anche da `tokens` e può ricentrare continuamente un token precedentemente localizzato. `App` conosce `sessionToken`, selezione e relazione con `sessionVehicle`. Le posizioni token nello stato client possono essere ottimistiche; solo `tokenWalkEvents` attestano l'avvio di una camminata accettata. Gli eventi sono già deduplicati e filtrati per scena dal percorso esistente.

## Goals / Non-Goals

**Goals:** mantenere visibile il PG durante l'avanzamento con il minimo spostamento, conservando il pan manuale e la separazione delle camere tra client.

**Non-Goals:** auto-pan durante la sola pianificazione, centratura remota, seguito di nemici/familiari, modifica di permessi o del movimento server, introduzione di una preferenza persistita.

## Decisions

1. `App` passa a entrambe le Board l'identità del PG seguito: quello canonico del Player o l'unico PG non familiare selezionato dal Master. L'identità è presentazione locale, non un nuovo campo condiviso. Seguire ogni token mobile farebbe contendere la camera a movimenti simultanei.
2. Una utility client pura calcola la correzione sui quattro bordi usando ingombro, camera e dimensioni reali della viewport in celle, ricavate da pixel / (cellSize × zoom effettivo). Non usa le celle aggiuntive di virtualizzazione. Il calcolo sposta solo l'asse che ne ha bisogno; applica i limiti finiti o di sicurezza e gestisce l'ingombro più grande centrando quell'asse. Riutilizzare direttamente `clampCamera` con l'overscan impedirebbe di raggiungere le ultime celle realmente visibili.
3. Il seguito viene attivato dalla camminata confermata del bersaglio e usa la sua posizione interpolata nel loop già presente. Non deriva dal semplice cambio di `tokens`, perché una richiesta rifiutata può aver già prodotto una posizione ottimistica. Al termine riallinea una sola volta alla posizione accettata; in veicolo segue l'animazione del mezzo con l'offset dell'occupante. Non serve una nuova sorgente di autorità nel client né una modifica al formato SSE.
4. Il comando localizza resta esplicito: consumare ogni nonce una sola volta evita che le modifiche successive dei token annullino un pan manuale. Il seguito non impone un centro fisso e non reagisce a render, ridimensionamenti o aggiornamenti non relativi a un avanzamento.
5. Cambio scena, scomparsa del bersaglio e sostituzione del bersaglio interrompono il seguito precedente. Riutilizzare deduplicazione e reset della camminata evita il replay dopo una riconnessione.

## Risks / Trade-offs

- [Overscan scambiato per spazio visibile] → verificare bordi inferiori/destri, celle parziali e ultima cella della scena con pixel effettivi.
- [Snapshot ottimistico o evento SSE tardivo] → agganciare il seguito soltanto alla camminata confermata; testare rifiuto, ordine snapshot/evento e assenza di replay.
- [Camera anticipa il token o segue due PG] → usare una sola identità e la posizione interpolata, non la destinazione condivisa.
- [Localizzazione precedente annulla il pan] → consumo del nonce, regressione dedicata per aggiornamenti non relativi al movimento.
- [Due Board montate] → camere indipendenti e stesso bersaglio, con viewport e zoom effettivi propri.

## Migration Plan

Nessuna migrazione dati o API. Distribuire il solo client dopo verifica. Il rollback ripristina il precedente comportamento della camera senza interventi sui dati; preservare le modifiche dello zoom preesistenti.
