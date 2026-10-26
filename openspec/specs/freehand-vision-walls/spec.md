# freehand-vision-walls Specification

## Purpose

Consentire al Master di ricalcare muri sulla mappa come tracciati persistenti che bloccano luce e visuale senza bloccare implicitamente il movimento.

## Requirements

### Requirement: Ricalco libero dei muri della mappa

Il Master SHALL poter selezionare «Disegna muri» nella preview di Preparazione scena e tracciare sulla mappa con un gesto libero simile alla matita, anche sopra uno sfondo fotografico. I tratti SHALL seguire coordinate precise anche non allineate alla griglia e SHALL restare allineati durante pan e zoom. Il gesto SHALL restare una bozza fino alla conferma e SHALL poter essere annullato senza salvare.

#### Scenario: Ricalco di una foto

- **WHEN** il Master usa una foto calibrata come sfondo e ne ripassa un muro diagonale con Disegna muri
- **THEN** il tratto confermato segue il muro senza aggancio obbligatorio alle celle e diventa una barriera visiva distinta dal disegno decorativo

#### Scenario: Gesto annullato

- **WHEN** il Master preme Escape, perde il gesto o cambia scena prima di completarlo
- **THEN** la bozza viene scartata senza salvare un muro o cambiare la visione dei Player

### Requirement: Occlusione della luce e della visuale

I muri confermati SHALL bloccare luce e visuale, inclusa la scurovisione, da entrambi i lati e secondo il tracciato effettivo, senza usare l'intero rettangolo che lo contiene come barriera. Giunzioni chiuse SHALL NOT lasciare fessure numeriche; aperture reali SHALL mantenere il passaggio della visuale. Questi muri SHALL NOT introdurre blocco del movimento implicito.

#### Scenario: Stanza chiusa

- **WHEN** un PG o una luce si trova da un lato di un muro che chiude una stanza non esplorata
- **THEN** il contenuto oltre il muro non è rivelato da quella visuale o fonte, anche con scurovisione

#### Scenario: Apertura del corridoio

- **WHEN** due tratti lasciano un'apertura reale fra le loro estremità
- **THEN** luce e visuale passano attraverso l'apertura secondo le normali regole di distanza e ostacoli

#### Scenario: Muro diagonale

- **WHEN** un tratto diagonale attraversa una stanza
- **THEN** occlude lungo la diagonale senza nascondere tutto il suo rettangolo di ingombro

### Requirement: Gestione selettiva e persistente

Solo il Master SHALL poter creare, selezionare o cancellare muri e annullare/ripetere tali operazioni. La cancellazione dei muri SHALL NOT eliminare disegni, elementi o token sovrapposti. I muri SHALL essere salvati per scena e recuperati alla riapertura; la history muri SHALL essere separata dal drawing e dallo stato live, limitata a 40 operazioni per scena e vuota al riavvio.

#### Scenario: Gomma muri

- **WHEN** il Master cancella un muro sovrapposto a un tratto decorativo
- **THEN** solo il muro selezionato viene rimosso e la visuale viene ricalcolata senza cancellare il disegno

#### Scenario: Undo e riapertura

- **WHEN** il Master annulla una rimozione e successivamente riapre la scena dopo un riavvio
- **THEN** il muro ripristinato rimane salvato e la history transitoria riparte vuota

### Requirement: Coerenza delle scene e degli errori

Le mutazioni muri SHALL essere versionate e atomiche. Modificare la scena attiva SHALL aggiornare la visione dei client dopo il commit; una scena inattiva SHALL restare preparazione privata. Richieste non autorizzate, versioni obsolete e scritture fallite SHALL lasciare invariati muri e proiezione. Scene precedenti senza muri SHALL continuare a caricarsi con layer vuoto.

#### Scenario: Scena inattiva

- **WHEN** il Master traccia muri in una scena inattiva
- **THEN** vengono conservati in quella scena senza cambiare la board attiva o consegnare dati inattivi ai Player

#### Scenario: Conflitto o scrittura fallita

- **WHEN** la versione della scena è obsoleta oppure SQLite rifiuta il salvataggio
- **THEN** la mutazione viene rifiutata senza aggiungere muri parziali o anticiparne l'effetto sui Player

#### Scenario: Player e legacy

- **WHEN** un Player tenta di disegnare un muro oppure viene caricata una scena priva del nuovo layer
- **THEN** la richiesta del Player è negata e la scena legacy resta valida con nessun muro aggiuntivo

### Requirement: Integrazione con memoria e sfumatura

I muri SHALL vincolare sia la visuale corrente sia la scoperta di nuove regioni. La sfumatura del nero SHALL NOT mostrare dettagli oltre un muro verso una zona sconosciuta. Aggiungere un muro SHALL NOT cancellare la memoria del terreno già esplorato, ma tale memoria SHALL NOT concedere visuale attuale sulle creature oltre la barriera.

#### Scenario: Nuova barriera in zona ricordata

- **WHEN** il Master aggiunge un muro su una regione già esplorata
- **THEN** il terreno ricordato resta disponibile, mentre la nuova visuale e le nuove scoperte rispettano il muro

#### Scenario: Bordo sfumato contro il muro

- **WHEN** il bordo della zona scoperta incontra un muro che nasconde terreno sconosciuto
- **THEN** il bordo resta morbido sul lato rivelato e il terreno oltre il muro rimane nero pieno
