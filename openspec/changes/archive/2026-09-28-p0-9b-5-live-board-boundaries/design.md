# Design

## Context

Vedi `proposal.md`. La board corrente usa dimensioni positive per clipping, camera e validazione dei token; il dialog usa una preview con rapporto e altezza massima CSS che possono deformare la griglia. Le dimensioni sono normalizzate sia nel modello scena sia nello snapshot live e replicate ai client.

## Goals / Non-Goals

**Goals:** un'unica semantica dimensionale attraverso scena, stato live e board; preview fedele alla bozza; rendering proporzionato senza allocare una superficie infinita.

**Non-Goals:** immagine ripetuta, coordinate negative, espansione automatica delle dimensioni in base all'immagine, nuova unità di misura o cambio delle regole di movimento.

## Decisions

1. `columns === 0 && rows === 0` rappresenta l'unica modalità illimitata. Una coppia mista è un errore, non una board illimitata su un solo asse. Questo evita stati ambigui nei consumer e preserva tutte le scene finite esistenti. Alternativa scartata: usare `null` o un nuovo flag, che richiederebbe migrazione e doppia fonte di verità.
2. La preview riceve le dimensioni dalla bozza del dialog, non dal documento persistito. Un contenitore con dimensioni calcolate dalla stessa scala sui due assi, eventualmente scrollabile, mantiene le celle quadrate; una maschera/linea sovrapposta indica il confine e l'area esclusa. Il CSS non deve comprimere un solo asse con `max-height`. Alternativa scartata: usare soltanto `aspect-ratio`, perché il vincolo di altezza corrente può comunque deformare il contenuto.
3. La board illimitata usa una finestra di celle derivata dalla camera e dal viewport, più un piccolo margine per gli elementi ai bordi. Immagine e overlay condividono le coordinate della board; l'asset conserva la propria estensione naturale calibrata. La camera resta vincolata all'origine ma non al bordo positivo. Alternativa scartata: creare un DOM/canvas di dimensione enorme, che degrada prestazioni e precisione.
4. La validazione lato server conserva coordinate intere non negative entro un limite tecnico esplicito e limiti di complessità per singola richiesta di movimento. Questi limiti difensivi non introducono un bordo visibile della board: servono a evitare overflow e percorsi arbitrariamente costosi. Client e server applicano la stessa forma di coordinate e il server resta autorevole.
5. La transizione fra scena finita e illimitata passa per la mutazione di scena versionata esistente. La bozza non entra nello snapshot; dopo conferma, il nuovo assetto viene normalizzato e distribuito via flusso corrente. Se si torna a dimensioni finite, posizioni o elementi esterni al nuovo bordo devono essere gestiti secondo i controlli esistenti, senza troncamenti silenziosi.

## Risks / Trade-offs

- [Pan a distanze molto grandi e precisione numerica] → imporre limiti tecnici di coordinate e testare conversione puntatore/camera ai bordi.
- [Percorsi lunghi costosi per il server] → limitare punti/passi elaborabili prima di iterare, con rifiuto atomico.
- [Preview diversa dalla board] → condividere costanti geometriche e verificare celle e confini con test mirati e prova UI a più dimensioni viewport.
- [Client legacy che interpreta zero come default] → aggiornare tutti i normalizzatori e verificare snapshot HTTP/SSE e persistenza prima della consegna.

## Migration Plan

Nessuna migrazione SQL necessaria: il documento JSON e lo snapshot accolgono la coppia `0 × 0` dopo l'aggiornamento dei normalizzatori. Le scene finite restano invariate. In rollback, riportare prima le scene illimitate a dimensioni positive tramite una versione compatibile o conservare il backup dei documenti scena; una versione precedente non comprende `0 × 0`.
