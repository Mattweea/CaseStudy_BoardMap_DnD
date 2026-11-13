## MODIFIED Requirements

### Requirement: Ricalco libero dei muri della mappa

Il Master SHALL poter selezionare «Disegna muri» nella preview di Preparazione scena e scegliere fra Libero e Segmenti, anche sopra uno sfondo fotografico. Libero SHALL conservare il ricalco continuo simile alla matita. Segmenti SHALL aggiungere un solo vertice per clic, mostrare l'anteprima del prossimo tratto e salvare una sola spezzata soltanto dopo conferma con Spazio, Invio o il pulsante dedicato. Il form con coordinate numeriche SHALL essere sostituito dal selettore delle modalità. I tratti SHALL seguire coordinate precise anche non allineate alla griglia e SHALL restare allineati durante pan e zoom. Il gesto SHALL restare una bozza fino alla conferma e SHALL poter essere annullato senza salvare. Cambiare modalità o scena, disattivare lo strumento o renderlo indisponibile SHALL scartare la bozza; le scorciatoie SHALL rispettare i campi di testo.

#### Scenario: Ricalco di una foto

- **WHEN** il Master usa una foto calibrata come sfondo e ne ripassa un muro diagonale con Disegna muri in modalità Libero
- **THEN** il tratto confermato segue il muro senza aggancio obbligatorio alle celle e diventa una barriera visiva distinta dal disegno decorativo

#### Scenario: Spezzata con pochi vertici

- **WHEN** il Master seleziona Segmenti, indica tre punti e sposta il puntatore fra i clic
- **THEN** la bozza contiene soltanto i tre vertici indicati, mostra l'anteprima e viene salvata come un solo muro soltanto dopo conferma

#### Scenario: Correzione e annullamento

- **WHEN** il Master usa Backspace sulla bozza a segmenti, poi Escape oppure cambia modalità o scena
- **THEN** Backspace rimuove l'ultimo vertice ed Escape o il cambio scartano la bozza senza scritture

#### Scenario: Gesto annullato

- **WHEN** il Master preme Escape, perde il gesto libero o cambia scena prima di completarlo
- **THEN** la bozza viene scartata senza salvare un muro o cambiare la visione dei Player

#### Scenario: Errore o conflitto

- **WHEN** il salvataggio confermato di una spezzata viene rifiutato per autorizzazione, versione obsoleta o errore di persistenza
- **THEN** nessun muro parziale viene mostrato come salvato e la vista viene riconciliata con la scena autorevole
