## Why

Quando un PG supera il bordo della viewport, la camera rimane ferma e il personaggio scompare dalla visuale. Il problema è particolarmente evidente sulle mappe alte dopo l'adattamento dello zoom alla larghezza.

## What Changes

- Seguire automaticamente il PG in movimento quando il suo ingombro supera l'area effettivamente visibile, spostando la camera solo quanto necessario.
- Per il Player seguire il proprio PG canonico, anche quando viaggia su un veicolo; per il Master seguire il PG selezionato singolarmente.
- Usare la posizione mostrata durante la camminata confermata, mantenendo stabile la camera mentre il PG è già visibile.
- Applicare lo stesso comportamento alla vista normale e fullscreen, con pannello aperto o chiuso, zoom diversi e scene finite o illimitate.
- Mantenere camera e scelta del bersaglio locali al browser, con reset al cambio scena e nessun seguito di movimenti rifiutati o sole anteprime.

## Capabilities

### New Capabilities

Nessuna nuova capability autonoma.

### Modified Capabilities

- `session-workspace`: aggiungere il requisito di accompagnamento locale del PG oltre i bordi visibili.

## Impact

- `src/components/Board.tsx`: camera, misura reale della viewport, animazione di cammino e localizzazione esplicita.
- `src/App.tsx`: risoluzione del PG seguito in base al ruolo e passaggio alle due Board.
- Utility client pura per il calcolo della camera e relativi test con il runner Node esistente.
- `Docs/ai/frontend/board_interaction_and_visibility.md`: aggiornamento del contratto di interazione durante Apply.
- Nessun nuovo endpoint, payload SSE, dipendenza o campo persistito. Preservare la correzione dello zoom orizzontale già presente nel workspace.

Assunzione di ambito: il Master segue solo il PG selezionato singolarmente; la camera degli altri client continua a dipendere dal rispettivo PG, senza comandi di centratura remota.
