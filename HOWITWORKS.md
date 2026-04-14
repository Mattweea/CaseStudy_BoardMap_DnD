# How It Works

Guida operativa della battle map condivisa.

## Panoramica

L'app e composta da:

- sidebar sinistra con sessione, dice roller e tracker iniziativa
- area centrale con la board interattiva
- modali per elementi, iniziativa, log dadi e manuale

Lo stato della partita vive sul server Fastify e viene sincronizzato in tempo reale fra tutti i client autenticati. In locale viene salvato solo lo zoom della board.

## Accesso

Il login non usa piu utenti liberi o generici. Si sceglie un profilo da una lista fissa e si entra con la password predefinita.

Regola password:

- `username + 123`

Roster attuale:

- `master` / `master123`
- `ilthar` / `ilthar123`
- `thalendir` / `thalendir123`
- `ragnar` / `ragnar123`
- `hunter` / `hunter123`
- `sylas` / `sylas123`
- `vesuth` / `vesuth123`

## Ruoli

### Master

Il master puo:

- modificare la battle map
- aggiungere nuovi elementi
- modificare o rimuovere elementi esistenti
- muovere token
- tirare l'iniziativa per tutti
- impostare iniziative manuali
- riordinare i pareggi
- scegliere il token attivo del turno
- avanzare o tornare indietro con `Next` e `Prev`

### Adventurer

L'avventuriero puo:

- entrare con il proprio personaggio
- vedere il proprio personaggio spawnare o riallinearsi in mappa
- consultare board, manuale, log dadi e ordine turni
- tirare dadi col proprio nome di sessione
- selezionare token e localizzarli

L'avventuriero non puo:

- creare elementi
- modificare o rimuovere elementi
- spostare token
- gestire iniziativa
- cambiare il turno attivo

## Spawn dei personaggi

Quando entra un personaggio giocante:

- il server controlla se esiste gia un token associato a quell'utente
- se manca, lo crea in mappa
- se esiste, lo riallinea ai dati canonici del personaggio
- il token resta legato all'utente autenticato

Ogni personaggio del party ha:

- nome visualizzato
- immagine da `media/images`
- bonus iniziativa
- eventuale modalita iniziativa speciale
- movimento e visione mostrati nella sidebar

Le immagini vengono applicate come sfondo del token in board.

## Sincronizzazione realtime

Gli aggiornamenti validi del server vengono propagati a tutti i client con SSE.

Vengono sincronizzati:

- token presenti in mappa
- posizioni
- condizioni
- log dadi
- iniziative
- token attivo del turno

Se il master cambia qualcosa, gli altri client vedono il risultato senza refresh.

## Mappa

### Navigazione

- zoom con rotellina del mouse sopra la board
- pan con `Ctrl + drag`
- pan anche con click centrale
- fullscreen tramite il pulsante dedicato

### Selezione

- `Click` su un token: selezione
- `Shift + click`: multiselezione
- `Drag` sullo sfondo: selezione ad area
- `Shift + drag` sullo sfondo: aggiunge alla selezione corrente

### Movimento

Solo il master puo spostare elementi.

- il drag usa snap a griglia
- piu token selezionati mantengono gli offset reciproci
- durante il drag compare l'highlight della destinazione

### Elementi supportati

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

## Gestione elementi

### Nuovo elemento

Il pulsante `Nuovo elemento` e visibile solo al master.

Da qui il master puo creare:

- player custom
- nemici
- oggetti
- mezzi

Per i personaggi del party non serve usare questa modale: i loro token vengono gestiti dal login e dal roster canonico.

### Lista elementi

`Elementi in mappa` e visibile a tutti.

Permette di:

- vedere tutto cio che e presente in board
- localizzare rapidamente un token
- filtrare per tipo

Solo il master puo anche:

- aprire la modifica
- rimuovere un elemento

### Modifica elemento

Solo il master puo aprire la modale di modifica.

Si possono aggiornare, a seconda del tipo:

- nome
- taglia
- coordinate
- colore
- modificatore iniziativa
- mezzo associato
- occupanti del mezzo
- condizioni

## Dice roller

Il dice roller e condiviso ma l'identita del tiro e personale.

Comportamento attuale:

- il tiro viene sempre registrato col nome del profilo autenticato
- non dipende piu dal token selezionato in board
- il log e visibile da tutti i client
- supporta modalita `normal`, `advantage`, `disadvantage`
- supporta modificatore e label personalizzata

Questo permette a ogni giocatore di tirare i propri dadi senza ambiguita nel log.

## Iniziativa

### Regole di accesso

Solo il master puo modificare l'iniziativa.

Gli avventurieri possono:

- vedere l'ordine aggiornato
- vedere il token attivo
- localizzare i token dalla lista

### Roll globale

Nel modale `Roll for initiative` il master puo:

- tirare per tutti
- impostare manualmente ogni valore
- salvare tutti i valori manuali
- resettare un singolo valore

Per il roll globale:

- viene usato `d20 + modificatore iniziativa`
- Ragnar tira con vantaggio in automatico

### Ordine turni

Nel pannello iniziativa il master puo:

- cliccare una riga per rendere attivo quel token
- trascinare le righe per riordinare i pareggi
- usare `Reset` per svuotare l'ordine

### Turno attivo

Una volta definito l'ordine:

- il master puo scegliere direttamente chi sta agendo
- `Next` passa al token successivo
- `Prev` torna al token precedente
- a fine round si torna automaticamente all'inizio

Il token attivo resta sincronizzato su tutti i client.

## Sidebar sessione

La card sessione mostra:

- nome del profilo autenticato
- ruolo
- per gli avventurieri, movimento e visione
- eventuali note personaggio principali

## Live session con ngrok

### Script rapido

Per una sessione live rapida:

```bash
./start-live-session.sh
```

Lo script:

- avvia `npm run dev:server`
- apre `ngrok http 5173`
- legge l'host pubblico
- avvia il frontend con host ngrok autorizzato
- stampa il link da condividere

### Procedura manuale

Backend:

```bash
npm run dev:server
```

Frontend:

```bash
npm run dev
```

Tunnel:

```bash
ngrok http 5173
```

Se Vite blocca l'host pubblico, riavvia il frontend con:

```bash
__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS=<host-ngrok> npm run dev
```

### Cosa condividere

Condividi ai giocatori l'URL HTTPS del frontend esposto da ngrok, non la porta `3001`.

## Configurazione roster

Il roster personaggi e hardcoded e deve restare coerente fra frontend e backend.

Se vuoi cambiare:

- nomi
- username
- password implicita
- immagini
- posizioni spawn
- bonus iniziativa
- ruolo

devi aggiornare entrambi:

- `src/constants/characters.ts`
- `server/characters.mjs`

Dopo modifiche lato server, riavvia `npm run dev:server`.

## Limiti attuali

- lo stato condiviso vive in memoria: un riavvio del backend resetta la partita
- il roster non e ancora configurabile da pannello admin o file esterno unico
- i personaggi del party sono gestiti come profili canonici, non come utenti arbitrari creati a runtime
- chiunque abbia link e credenziali valide puo entrare nella sessione

## Troubleshooting rapido

- login non riuscito: controlla che backend e frontend siano avviati
- il personaggio non appare: verifica di aver fatto login col profilo corretto e riavvia il backend se hai appena cambiato il roster
- gli altri client non vedono gli aggiornamenti: controlla SSE, backend attivo e tunnel ngrok puntato alla porta `5173`
- la partita si resetta dopo restart: e previsto, perche non esiste persistenza server-side
