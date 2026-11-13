# scene-preparation-wizard Specification

## Purpose

Guidare il Master dalla scelta della base della mappa alla preparazione di pareti, luci ed encounter, con un'anteprima comune e un'attivazione esplicita della scena.

## Requirements

### Requirement: Percorso di preparazione navigabile

Il sistema SHALL offrire soltanto al Master un percorso composto da Base, Pareti e ambiente, Luci e visuale, Encounter e Riepilogo. Durante l'editing SHALL mantenere disponibile la stessa anteprima della mappa e indicare il passaggio corrente. Il Master SHALL poter tornare indietro e accedere direttamente ai passaggi di una scena esistente, risolvendo prima eventuali modifiche non salvate. Gli encounter SHALL essere facoltativi e una scena SHALL poter contenerne più di uno. Navigare fra i passaggi SHALL NOT attivare scene né avviare combattimenti.

#### Scenario: Preparazione senza encounter

- **WHEN** il Master prepara una mappa e salta il passaggio Encounter
- **THEN** può raggiungere il riepilogo e conservare una scena valida senza encounter

#### Scenario: Modifica mirata

- **WHEN** il Master riapre una scena esistente e seleziona Luci e visuale
- **THEN** accede ai controlli delle luci senza ripetere la creazione della base o degli encounter e l'anteprima mantiene la stessa geometria

#### Scenario: Accesso Player

- **WHEN** un Adventurer visualizza la sessione
- **THEN** il wizard e i documenti delle scene inattive non sono disponibili

### Requirement: Due percorsi di partenza combinabili

Il passaggio Base SHALL offrire lo switch «Costruisci da zero / Parti da un'immagine». Il primo percorso SHALL proporre griglia e strumenti a celle; il secondo SHALL proporre caricamento e calibrazione dell'immagine e strumenti di ricalco. Entrambi SHALL consentire pareti a celle e tracciati sulla stessa griglia. Cambiare percorso SHALL conservare immagine già associata, calibrazione, pareti, disegni, luci ed encounter, e SHALL NOT duplicare la scena o cancellare dati. L'eventuale rimozione dello sfondo SHALL richiedere il comando esplicito già previsto.

#### Scenario: Dungeon costruito sulla griglia

- **WHEN** il Master sceglie Costruisci da zero in una nuova scena
- **THEN** può iniziare da una griglia senza immagine e aggiungere pareti a celle

#### Scenario: Ricalco e celle combinati

- **WHEN** il Master carica e allinea un'immagine, traccia una diagonale e aggiunge una parete a celle
- **THEN** entrambi i tipi di barriera restano disponibili sulla stessa mappa

#### Scenario: Switch reversibile

- **WHEN** il Master cambia percorso dopo aver preparato immagine, pareti e un encounter e poi torna al percorso iniziale
- **THEN** i contenuti sono conservati e lo switch da solo non produce una mutazione della scena

### Requirement: Bozze e salvataggi espliciti

Il wizard SHALL distinguere modifiche salvate, bozze di campi e gesti non confermati. Le bozze di Base e dei campi luce SHALL richiedere un salvataggio esplicito; un gesto completato SHALL seguire la conferma del relativo strumento. Navigazione, cambio scena e chiusura con campi modificati SHALL offrire salvataggio, scarto oppure permanenza nel passaggio. Un gesto incompleto SHALL essere annullato al cambio di passaggio, scena o strumento senza essere salvato. Un salvataggio fallito SHALL lasciare il Master sul passaggio corrente con un motivo leggibile; un conflitto SHALL riallineare la base alla versione autorevole senza sovrascriverla automaticamente. I contenuti già salvati SHALL essere recuperabili riaprendo la scena; le bozze non confermate SHALL NOT essere presentate come persistite.

#### Scenario: Salva e continua

- **WHEN** il Master modifica la calibrazione e usa Salva e continua
- **THEN** il passaggio successivo viene aperto soltanto dopo il salvataggio riuscito della configurazione

#### Scenario: Cambio passaggio con campi modificati

- **WHEN** il Master tenta di lasciare un passaggio con campi non salvati e sceglie di restare
- **THEN** conserva la bozza e il passaggio corrente senza mutazioni

#### Scenario: Cambio passaggio durante un gesto

- **WHEN** il Master cambia passaggio mentre sta tracciando un muro non confermato
- **THEN** la bozza del gesto scompare e nessun muro viene aggiunto

#### Scenario: Versione obsoleta

- **WHEN** un salvataggio viene rifiutato perché un altro Master ha aggiornato la scena
- **THEN** il wizard mostra il conflitto e la versione corrente senza avanzare né pubblicare la bozza obsoleta

### Requirement: Prova locale della visuale

Nel passaggio Luci e visuale il Master SHALL poter posizionare e spostare un osservatore temporaneo e impostarne il raggio di visione in caselle. La prova SHALL usare pareti, elementi e luci della scena selezionata con le regole geometriche correnti, mostrando la visuale risultante separatamente dalla memoria esplorata. L'osservatore SHALL restare locale al client, SHALL NOT creare token, muovere personaggi, modificare la memoria esplorata, attivare scene o pubblicare eventi di gioco. Uscire dalla prova o cambiare scena SHALL rimuovere l'osservatore.

#### Scenario: Luce oltre una parete

- **WHEN** il Master posiziona un osservatore di prova davanti a una parete con un'apertura e una luce sul lato opposto
- **THEN** la preview mostra il passaggio della visuale attraverso l'apertura rispettando l'occlusione delle parti chiuse

#### Scenario: Scena già esplorata

- **WHEN** il Master prova la visuale in una regione già ricordata dal party
- **THEN** la prova distingue la visuale corrente dal terreno ricordato senza modificare la memoria persistita

#### Scenario: Prova privata di una scena inattiva

- **WHEN** il Master sposta l'osservatore in una scena inattiva e poi cambia scena
- **THEN** l'osservatore scompare e stato live, memoria e vista degli altri client restano invariati

### Requirement: Riepilogo e attivazione separati

Il riepilogo SHALL presentare base, dimensioni, pareti, luci ed encounter salvati e consentire di tornare al relativo passaggio. SHALL distinguere scena attiva e preparazione privata. L'attivazione e l'attivazione con trasferimento del party SHALL richiedere comandi espliciti dal riepilogo, con le verifiche di versione, round, layout e autorizzazione esistenti. Salvare una modifica della scena attiva SHALL mantenere la pubblicazione corrente dopo il commit; salvare una scena inattiva SHALL NOT distribuirne i contenuti ai Player.

#### Scenario: Preparazione senza attivazione

- **WHEN** il Master completa i passaggi e chiude una scena inattiva dopo i salvataggi
- **THEN** può riprendere i contenuti preparati e il party resta nella scena corrente

#### Scenario: Scena attiva modificata

- **WHEN** il Master conferma una modifica valida alle luci o alle pareti della scena attiva
- **THEN** i client ricevono la configurazione confermata senza attendere una seconda attivazione

#### Scenario: Trasferimento divenuto obsoleto

- **WHEN** il Master conferma un trasferimento la cui preview non corrisponde più alle versioni correnti
- **THEN** il server lo rifiuta senza attivazione o trasferimento parziale e il wizard richiede una nuova preview
