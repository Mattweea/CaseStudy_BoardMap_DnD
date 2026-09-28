# Spec Delta

## ADDED Requirements

### Requirement: Preview live dei confini della board
Nel dialog di preparazione la preview SHALL aggiornare il confine della board mentre il Master modifica righe e colonne, prima del salvataggio. SHALL distinguere visivamente l'area inclusa da quella esclusa, mostrare il taglio dell'immagine quando esce dai confini e mantenere ogni cella della griglia quadrata anche al ridimensionamento del dialog e del viewport. La preview SHALL rappresentare la bozza locale e SHALL NOT cambiare la scena condivisa finché il Master non conferma.

#### Scenario: Riduzione delle dimensioni
- **WHEN** il Master riduce colonne o righe rispetto all'immagine calibrata
- **THEN** la preview sposta immediatamente il confine e rende riconoscibile la parte dell'immagine che non comparirà sulla board

#### Scenario: Celle quadrate con anteprima ridimensionata
- **WHEN** il dialog o il viewport cambia dimensione
- **THEN** i lati orizzontale e verticale di ogni cella nella preview restano uguali

#### Scenario: Annullamento della bozza
- **WHEN** il Master modifica le dimensioni e chiude il dialog senza salvare
- **THEN** la board e la scena condivisa mantengono le dimensioni precedenti

### Requirement: Board senza confini con dimensioni zero
Una scena configurata con `0 × 0` SHALL avere una griglia logicamente illimitata verso destra e verso il basso a partire dall'origine. Il viewport SHALL mostrare soltanto le celle necessarie alla visuale corrente e SHALL permettere pan e zoom oltre l'immagine calibrata; l'immagine SHALL mantenere la propria estensione, senza essere ripetuta o dilatata per riempire la griglia. Le dimensioni positive SHALL continuare a delimitare la board come prima.

#### Scenario: Nessun ritaglio in modalità illimitata
- **WHEN** il Master salva `0 × 0` e l'immagine supera le vecchie dimensioni della board
- **THEN** il viewport può raggiungere l'intera immagine e proseguire sulla griglia neutra oltre il suo bordo

#### Scenario: Board finita esistente
- **WHEN** viene caricata una scena con righe e colonne positive
- **THEN** il limite della board resta quello persistito e il comportamento corrente non cambia

#### Scenario: Preview della modalità illimitata
- **WHEN** il Master imposta entrambe le dimensioni a zero nella bozza
- **THEN** la preview comunica che non esiste un confine di taglio e mantiene una griglia a celle quadrate
