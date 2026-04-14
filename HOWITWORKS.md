# How It Works

Questo documento descrive in dettaglio tutte le funzionalita presenti nella battle map e come usarle in una sessione condivisa.

## Panoramica

L'app e composta da tre aree principali:

- sidebar sinistra con dice roller e tracker iniziativa
- area centrale con la mappa interattiva
- modali di supporto per elementi, log dadi, iniziativa e manuale

Lo stato della partita vive sul server Fastify e viene sincronizzato in tempo reale fra i client autenticati. In locale viene salvato solo lo zoom della board.

## Accesso e ruoli

Prima di entrare nella mappa serve fare login.

- `master`: puo modificare token, iniziativa e stato della partita
- `adventurer`: puo consultare la board, zoomare, fare pan, aprire manuale e vedere gli aggiornamenti live

Credenziali demo:

- `master` / `master123`
- `aria` / `adventurer123`
- `borin` / `adventurer123`

## Sincronizzazione

Quando il `master` modifica la partita:

- elementi presenti in mappa
- log dei dadi
- iniziative
- token attivo del turno

gli altri client vedono l'aggiornamento senza refresh.

## Live session con ngrok

Se vuoi usare la mappa con la compagnia senza fare deploy, la strada piu semplice e aprire un tunnel HTTPS verso il frontend Vite. Il backend Fastify resta locale e viene raggiunto dal frontend tramite il proxy `/api`.

### Script rapido consigliato

Se vuoi evitare i passaggi manuali, usa lo script incluso nel repository:

```bash
./start-live-session.sh
```

Lo script:

- avvia `npm run dev:server`
- apre `ngrok http 5173`
- legge l'URL pubblico da ngrok
- avvia Vite con `__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS` gia valorizzato
- stampa il link pubblico da condividere

Se vuoi utenti personalizzati, esporta prima `AUTH_USERS_JSON` e poi lancia lo script.

### Prerequisiti

Ti servono:

- Node.js 18 o superiore
- `npm install` eseguito nel repository
- un account ngrok
- il client ngrok installato localmente

### Setup iniziale ngrok

Dopo l'installazione del client:

```bash
ngrok config add-authtoken <IL_TUO_TOKEN>
```

Il token si recupera dalla dashboard ngrok.

### Avvio locale della sessione

In un primo terminale avvia il backend:

```bash
npm run dev:server
```

In un secondo terminale avvia temporaneamente il frontend:

```bash
npm run dev
```

In un terzo terminale apri il tunnel:

```bash
ngrok http 5173
```

ngrok ti mostrera un URL pubblico simile a:

```text
https://abc123.ngrok-free.app
```

Copialo: ti serve nel passaggio successivo.

### Riavvio del frontend con host ngrok autorizzato

Vite filtra gli host ammessi. Per permettere al dominio ngrok di raggiungere il dev server, ferma il frontend e riavvialo cosi:

```bash
__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS=abc123.ngrok-free.app npm run dev
```

Se usi piu host, puoi passarli separati da virgola.

### URL da condividere

Condividi ai giocatori l'URL HTTPS di ngrok del frontend, per esempio:

```text
https://abc123.ngrok-free.app
```

Non serve esporre direttamente la porta `3001`.

### Credenziali per la sessione

Per test veloci puoi usare gli utenti demo:

- `master` / `master123`
- `aria` / `adventurer123`
- `borin` / `adventurer123`

Per una sessione reale conviene sovrascriverli con `AUTH_USERS_JSON` prima di avviare il backend:

```bash
export AUTH_USERS_JSON='[
  {"id":"master","username":"dm","password":"una-password-forte","displayName":"DM","role":"master"},
  {"id":"p1","username":"aria","password":"pwd-aria","displayName":"Aria","role":"adventurer"},
  {"id":"p2","username":"borin","password":"pwd-borin","displayName":"Borin","role":"adventurer"}
]'
```

Poi riavvia:

```bash
npm run dev:server
```

### Flusso consigliato per il giorno della sessione

1. Apri un terminale.
2. Se vuoi utenti reali, esporta `AUTH_USERS_JSON`.
3. Lancia `./start-live-session.sh`.
4. Apri tu stesso il link ngrok stampato dallo script.
5. Verifica login, board e sincronizzazione.
6. Condividi il link con i giocatori.

### Flusso manuale

Se preferisci controllare ogni processo a mano, puoi ancora usare la procedura manuale descritta sotto.

### Limiti attuali

- Lo stato condiviso vive in memoria nel processo Fastify: se il server si chiude o si riavvia, la partita si perde.
- Se il dominio ngrok cambia, devi riavviare il frontend aggiornando `__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS`.
- Chiunque abbia il link e credenziali valide puo entrare nella sessione.
- Se chi ospita spegne il PC o perde connessione, la sessione finisce.

### Troubleshooting rapido

- Pagina bianca o errore host: controlla `__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS`.
- Login non riuscito: verifica che `npm run dev:server` sia attivo.
- Dati che non si aggiornano: controlla che il tunnel punti alla porta `5173` e non alla `3001`.
- Sessione persa dopo restart: e previsto, perche oggi non c'e persistenza su file o database.

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
- Solo il `master` puo spostare elementi.

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

Solo il `master` puo creare nuovi elementi.

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

Solo il `master` puo aprire la modale di modifica.

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
- usare `Modifica` se sei `master`
- usare `Rimuovi` se sei `master`

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

## Iniziativa e dadi

- Il `master` puo tirare o impostare l'iniziativa e riordinare i pareggi.
- Gli `adventurer` vedono l'ordine aggiornarsi in tempo reale ma non possono modificarlo.
- I log dadi sono condivisi tra tutti i client autenticati.

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
