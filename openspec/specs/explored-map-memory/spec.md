# explored-map-memory Specification

## Purpose

Conservare per scena il terreno esplorato dal party, separando la memoria condivisa dalla visione attuale delle creature e dal runtime completo.

## Requirements

### Requirement: Esplorazione permanente del terreno

In una scena buia, il sistema SHALL ricordare le regioni effettivamente visibili dai PG del party lungo i percorsi accettati e SHALL mantenerne visibile il terreno dopo che i PG si sono allontanati. La scoperta SHALL rispettare raggio visivo, scurovisione, luci e ostacoli correnti. Le zone mai esplorate e non attualmente visibili SHALL restare nero pieno e opaco.

#### Scenario: Percorrere e ripercorrere un corridoio

- **WHEN** un PG percorre un corridoio buio, prosegue oltre il proprio raggio visivo e poi torna indietro
- **THEN** il terreno già visto del corridoio resta visibile durante tutto il tragitto, senza tornare nero

#### Scenario: Regione dietro una parete

- **WHEN** il PG percorre un corridoio senza poter vedere una stanza oltre una parete
- **THEN** il corridoio resta esplorato ma la stanza non viene rivelata dalla memoria

#### Scenario: Punti intermedi

- **WHEN** un movimento accettato attraversa più celle e termina oltre la visuale della partenza
- **THEN** la memoria include le regioni legittimamente viste lungo il percorso, non soltanto la destinazione

### Requirement: Conoscenza condivisa e isolata per scena

La memoria SHALL essere condivisa fra i partecipanti del party nella stessa campagna e SHALL restare distinta per scena. Il contributo di un PG SHALL essere visibile agli altri Player della scena attiva. Il cambio scena SHALL conservare la memoria precedente e SHALL NOT rivelare a un Player dati delle scene inattive.

#### Scenario: Due esploratori

- **WHEN** due PG esplorano porzioni differenti della stessa scena
- **THEN** entrambi i Player vedono il terreno scoperto dall'uno e dall'altro, senza perdere contributi concorrenti

#### Scenario: Cambio e ritorno

- **WHEN** il Master attiva una seconda scena e poi ritorna alla prima
- **THEN** ciascuna scena conserva soltanto la propria memoria e la prima mostra ancora il corridoio esplorato

#### Scenario: Evento ritardato

- **WHEN** arriva un aggiornamento di esplorazione della vecchia scena dopo una transizione
- **THEN** il client non lo applica alla scena nuova

### Requirement: Memoria distinta da luce e creature

La memoria SHALL rendere visibile il terreno esplorato senza creare una luce reale o estendere la visione attuale delle creature. I token dinamici SHALL continuare a rispettare visione attuale e permessi esistenti; un token nascosto dal Master SHALL NOT diventare visibile tramite la memoria. L'attivazione temporanea della luce completa SHALL NOT segnare l'intera mappa come esplorata né cancellare la memoria già acquisita.

#### Scenario: Nemico fuori visuale in un corridoio esplorato

- **WHEN** un nemico si sposta in un corridoio ricordato ma fuori dalla visione attuale dei PG
- **THEN** il terreno resta visibile senza rendere visibile il nemico grazie alla memoria

#### Scenario: Token nascosto

- **WHEN** il Master colloca un token nascosto in una regione già esplorata
- **THEN** la memoria non rimuove il suo stato nascosto e non lo rivela ai Player

#### Scenario: Luce completa temporanea

- **WHEN** il Master attiva la luce completa e poi riattiva il buio
- **THEN** restano visibili terreno già esplorato e visuale corrente, mentre il resto torna nero pieno

### Requirement: Esplorazione autorevole e coerente

Il server SHALL determinare l'esplorazione da PG e movimenti accettati, senza fidarsi di regioni dichiarate dal client. Preview e mosse rifiutate SHALL NOT espandere la memoria. Spostamenti diretti senza un percorso SHALL rivelare soltanto le regioni consentite all'arrivo. Undo del movimento SHALL NOT cancellare conoscenza acquisita. Un errore di persistenza SHALL lasciare invariati movimento e memoria senza pubblicare un successo parziale.

#### Scenario: Movimento rifiutato

- **WHEN** un Player prepara un percorso oppure tenta un movimento che viene rifiutato
- **THEN** nessuna regione viene esplorata da quel tentativo

#### Scenario: Spostamento diretto

- **WHEN** il Master riposiziona un PG senza indicare un percorso attraversato
- **THEN** viene valutata la visuale all'arrivo senza rivelare un corridoio immaginario fra le due posizioni

#### Scenario: Undo e persistenza fallita

- **WHEN** si annulla un movimento precedentemente accettato oppure fallisce il salvataggio di una nuova esplorazione
- **THEN** nel primo caso la memoria acquisita resta disponibile e nel secondo posizione e memoria non vengono aggiornate parzialmente

### Requirement: Durabilità e compatibilità della memoria

Il sistema SHALL salvare la memoria per campagna e scena e SHALL ripristinarla dopo reload, riconnessione o riavvio. Scene legacy senza memoria SHALL partire con memoria vuota e aggiungere solo la visuale legittima corrente. Ripristinare uno snapshot precedente SHALL NOT cancellare la memoria persistita più recente. Questo requisito SHALL NOT implicare il recupero dell'intero stato live delle scene.

#### Scenario: Rientro dopo il riavvio

- **WHEN** il server riparte dopo l'esplorazione confermata di un corridoio e il Player torna alla scena
- **THEN** il terreno del corridoio resta esplorato anche senza ripetere il percorso

#### Scenario: Snapshot precedente

- **WHEN** viene ripristinato uno snapshot privo di memoria o precedente a un'esplorazione già persistita
- **THEN** il caricamento rimane compatibile e non azzera le regioni già ricordate per quella scena

#### Scenario: Scena legacy

- **WHEN** si apre una scena precedente alla funzionalità
- **THEN** le zone attualmente visibili possono essere esplorate ma non vengono dedotti percorsi storici mai registrati
