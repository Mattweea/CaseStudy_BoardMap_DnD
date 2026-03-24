# How It Works

Questo documento descrive in dettaglio tutte le funzionalita presenti nella battle map e come usarle.

## Panoramica

L'app e composta da tre aree principali:

- sidebar sinistra con dice roller e tracker iniziativa
- area centrale con la mappa interattiva
- modali di supporto per elementi, log dadi, iniziativa e manuale

Lo stato dell'app viene salvato automaticamente in `localStorage`, quindi al refresh vengono recuperati:

- zoom
- elementi presenti in mappa
- log dei dadi
- iniziative
- token attivo del turno

## Mappa

### Navigazione della board

- La mappa e una griglia virtuale, quindi puoi continuare a esplorarla senza un limite pratico visibile.
- Lo zoom si controlla con la rotellina del mouse sopra la board.
- Il pan della camera si fa con `Ctrl + drag`.
- In alternativa il pan si puo fare anche con click centrale del mouse.

### Coordinate

- Le colonne usano numeri.
- Le righe usano lettere.
- Quando modifichi manualmente un elemento, `X` e la colonna e `Y` e la riga.
- Per token piu grandi di una casella, la coordinata rappresenta sempre l'angolo in alto a sinistra.

### Selezione elementi

- `Click` su un elemento: lo seleziona o lo deseleziona.
- `Shift + click`: aggiunge o rimuove quell'elemento dalla selezione corrente.
- `Drag` sullo sfondo: crea una selezione ad area.
- `Shift + drag` sullo sfondo: aggiunge alla selezione ad area esistente.

### Movimento elementi

- Trascina un elemento selezionato per spostarlo.
- Se hai piu elementi selezionati, il drag li muove insieme mantenendo i loro offset reciproci.
- Il movimento usa snap su griglia.
- Durante il drag compare un highlight della destinazione.

### Full screen

- Il pulsante `Full screen` apre una versione fullscreen della board.
- In fullscreen restano disponibili gli stessi pulsanti rapidi della mappa normale.
- Il pulsante cambia in `Chiudi full screen` quando la visualizzazione estesa e aperta.

### Manuale

- Il pulsante `Manuale` apre il manuale dentro una modale con `iframe`.
- La visualizzazione usa una preview embedded di Google Drive.
- L'utente resta dentro l'app e non viene spostato automaticamente su Drive.

## Tipi di elemento supportati

L'app gestisce quattro categorie:

- `PG`
- `Nemico`
- `Oggetto`
- `Mezzo`

Le taglie disponibili sono:

- Minuscola
- Piccola
- Media
- Grande
- Enorme
- Mastodontica

Le taglie occupano piu celle in modo coerente con la griglia.

## Aggiungere un elemento

Apri la modale con `Nuovo elemento`.

### Creazione PG, nemici e oggetti

Puoi impostare:

- tipo
- nome
- taglia
- quantita
- colore
- modificatore iniziativa per PG e nemici

Dettagli:

- se `Quantita` e maggiore di 1, i token vengono creati con nome progressivo, ad esempio `Goblin 1`, `Goblin 2`
- gli oggetti hanno iniziativa forzata a `0`
- il colore puo essere scelto da una palette

### Creazione mezzi

Per i mezzi puoi scegliere:

- tipo di mezzo
- affiliazione del mezzo: `PG` o `Nemici`
- occupanti iniziali
- se mostrare o nascondere gli occupanti in mappa
- modificatore iniziativa del mezzo

Mezzi supportati:

- Biruote infernale
- Tormentatore
- Tritademoni

Ogni mezzo ha:

- taglia predefinita
- capienza predefinita
- colore predefinito in base all'affiliazione

### Mezzi associati ai PG

Quando il mezzo e associato ai `PG`:

- puoi riempire i posti con token giocatore compatibili
- puoi decidere se gli occupanti devono essere visibili o no sulla mappa

### Mezzi associati ai nemici

Quando il mezzo e associato ai `Nemici`:

- puoi assegnare occupanti nemici esistenti
- puoi creare direttamente nuovi nemici dentro il mezzo
- il numero di nuovi nemici viene limitato automaticamente dai posti disponibili

## Modificare un elemento

Puoi aprire la modale di modifica in diversi modi:

- dalla lista `Elementi in mappa`
- con click destro su un elemento nell'ordine iniziativa
- dalle azioni dedicate in altri pannelli

### Modifica di PG e nemici

Puoi cambiare:

- tipo
- nome
- taglia
- coordinate
- colore
- modificatore iniziativa
- condizioni
- mezzo in cui sono contenuti

Azioni specifiche:

- `Fai salire`: aggancia il token a un mezzo compatibile
- `Scendi dal mezzo`: lo sgancia e lo rimette a piedi

Se un token cambia mezzo:

- viene rimosso dai posti del mezzo precedente
- viene aggiunto al nuovo mezzo

### Modifica di un oggetto

Puoi cambiare:

- tipo
- nome
- taglia
- coordinate
- colore

Gli oggetti non hanno condizioni giocatore/nemico e non partecipano all'iniziativa.

### Modifica di un mezzo

Puoi cambiare:

- tipo di mezzo
- affiliazione
- coordinate
- modificatore iniziativa
- occupanti
- visibilita degli occupanti in mappa
- condizioni del mezzo

Se il mezzo e nemico puoi anche:

- aggiungere nuovi nemici direttamente dal form

Nota operativa:

- se rimuovi un occupante dai posti del mezzo, quell'occupante viene sganciato
- se assegni un occupante al mezzo, la sua posizione viene sincronizzata con quella del mezzo

### Rimozione elemento

Nella modale di modifica e presente `Rimuovi elemento`.

Quando un elemento viene rimosso:

- sparisce dalla mappa
- viene rimosso dall'iniziativa se presente
- se era il token attivo del turno, il sistema aggiorna il riferimento al prossimo disponibile

## Lista elementi in mappa

Il pulsante `Elementi in mappa` apre una modale con tutti gli elementi raggruppati per tipo.

### Filtri e raggruppamenti

Puoi prioritizzare la visualizzazione per:

- PG
- Nemici
- Oggetti
- Mezzi

Ogni gruppo mostra:

- nome
- tipo
- taglia
- condizioni attive
- coordinate

### Azioni disponibili in lista

Per ogni elemento puoi:

- cliccare il nome per localizzarlo sulla mappa
- usare il pulsante con icona occhio per localizzarlo
- usare `Modifica`
- usare `Rimuovi`

Quando localizzi un elemento:

- la camera della board si centra su di lui
- il token viene selezionato

## Mezzi e occupanti

Il sistema supporta relazioni fra mezzo e occupanti.

### Regole di base

- un mezzo puo contenere creature compatibili con la sua affiliazione
- gli oggetti non possono essere occupanti
- un mezzo non puo contenere altri mezzi
- gli occupanti seguono sempre la posizione del mezzo

### Visibilita occupanti

Ogni mezzo ha l'opzione `Mostra occupanti in mappa`.

- se attiva, gli occupanti restano visibili sulla board
- se disattiva, gli occupanti restano nel mezzo ma vengono nascosti visivamente sulla mappa

### Coerenza automatica

Lo stato viene normalizzato automaticamente per:

- eliminare duplicati negli occupanti
- rimuovere riferimenti invalidi
- riallineare la posizione degli occupanti a quella del mezzo
- sganciare riferimenti a mezzi non piu esistenti

## Dice roller

Nel pannello dadi puoi scegliere:

- tipo di dado: `d4`, `d6`, `d8`, `d10`, `d12`, `d20`, `d100`
- quantita
- modificatore
- modalita: normale, vantaggio, svantaggio
- etichetta log

### Come funziona il tiro

- `Normale`: tira il numero di dadi richiesto
- `Vantaggio`: tira `2d20` e tiene il risultato piu alto
- `Svantaggio`: tira `2d20` e tiene il risultato piu basso

Il tiro usa un generatore casuale basato su `crypto.getRandomValues`, quindi:

- i risultati sono sempre compresi tra `1` e il massimo del dado
- ogni faccia valida ha probabilita uniforme

### Sequenza visuale del tiro

Quando premi `Tira dado`:

- il bottone entra in stato di lancio
- si apre una modale narrativa del risultato
- compare una frase contestuale
- poi viene rivelato il risultato
- la modale si chiude automaticamente
- solo dopo la chiusura il bottone torna allo stato normale

Alla chiusura della modale risultato vengono resettati:

- `Modalita` a `Normale`
- `Etichetta log`

### Log dei dadi

Il pulsante `Log` apre la cronologia degli ultimi tiri.

Per ogni tiro vengono mostrati:

- etichetta
- timestamp
- autore del tiro, se presente
- formula
- risultati ottenuti
- totale

Il log e limitato ai 30 tiri piu recenti.

E disponibile anche il pulsante `Reset log`.

## Tracker iniziativa

Il pannello iniziativa gestisce l'ordine dei turni per creature e mezzi.

### Funzioni principali

- apertura modale `Roll for initiative`
- reset completo iniziative
- selezione del turno attivo
- localizzazione del token attivo
- riordino manuale a drag in caso di pareggi

### Impostazione iniziativa

Dentro la modale dedicata puoi:

- tirare l'iniziativa per tutti
- salvare tutti i valori manuali
- inserire un valore manuale per singolo token
- salvare o resettare il singolo token

Per ogni creatura vengono mostrati:

- nome
- tipo
- modificatore iniziativa
- valore corrente con sorgente `rolled` o `manual`
- condizioni attive

### Ordine dei turni

Nel pannello principale:

- click su una riga: imposta il token come attivo e lo localizza
- click sul nome: stessa azione
- click destro sulla riga o sul nome: apre la modifica del token
- drag and drop tra elementi con lo stesso valore: riordina i pareggi

## Interazioni rapide importanti

- `Click` su token: selezione
- `Shift + click` su token: multiselezione
- `Drag` su token: spostamento
- `Drag` sullo sfondo: selezione ad area
- `Ctrl + drag` o click centrale: pan mappa
- rotellina mouse: zoom
- `Escape` nelle modali: chiusura

## Persistenza

Il progetto salva automaticamente in `localStorage`:

- elementi
- legami mezzo/occupanti
- condizioni
- zoom
- log dadi
- iniziative
- token attivo

Questo rende l'app adatta a sessioni locali senza backend.
