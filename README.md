# D&D Battle Map

Applicazione web per gestire una battle map condivisa di Dungeons & Dragons con React, TypeScript, Vite e un backend Fastify leggero.

Il repository e pensato come case study tecnico, ma oggi include anche un flusso di sessione piu vicino a una partita reale: roster fisso dei personaggi, login per ruolo, token del party che spawnano in mappa, tracker iniziativa condiviso e permessi distinti tra master e avventurieri.

## Obiettivo

L'app unisce in un'unica interfaccia:

- battle map tattica sincronizzata fra piu client
- gestione di token, nemici, oggetti e mezzi
- login a ruoli con sessione autenticata via cookie
- dice roller condiviso con log storico
- tracker iniziativa con turno attivo controllato dal master
- visibilita controllata dal master per preparare elementi nascosti ai player

## Stack

- React 18
- TypeScript
- Vite
- Fastify
- CSS custom
- cookie di sessione HTTP-only
- Server-Sent Events per la sincronizzazione realtime
- `localStorage` solo per lo zoom locale della board

## Funzionalita principali

- login tramite selezione di un profilo fisso: `master`, `Ilthar Neramyst`, `Thalendir`, `Ragnar`, `Hunter`, `Sylas Elveris`, `Vesuth Ronavior`
- password predefinita per ogni profilo: `username + 123`
- spawn automatico del personaggio in mappa al login, con immagine associata presa da `media/images`
- token giocatore legato all'utente autenticato in sessione
- dice roller associato al profilo online, non al token selezionato
- log dadi condiviso fra tutti i client
- iniziativa centralizzata: solo il master puo tirarla per tutti, modificarla e resettarla
- turno attivo condiviso con selezione manuale, `Next`, `Prev` e wrap automatico a fine round
- sospensione e ripresa della sessione tramite snapshot JSON persistito lato server
- salvataggio delle note condivise insieme allo snapshot della sessione
- permessi mappa: solo il master puo aggiungere, modificare, rimuovere o spostare elementi
- elementi creati dal master invisibili di default ai player, con toggle `Mostra`/`Nascondi`
- avvio combattimento dal pannello iniziativa con annuncio sincronizzato su tutti i client
- sidebar in modalita hover, bloccabile aperta dal pulsante dedicato
- visione live per gli avventurieri, che possono consultare board, manuale, log e ordine turni

## Roster attuale

| Profilo | Username | Password | Ruolo | Iniziativa | Note |
| --- | --- | --- | --- | --- | --- |
| Master | `master` | `master123` | `master` | `+0` | controllo completo |
| Ilthar Neramyst | `ilthar` | `ilthar123` | `adventurer` | `+3` | scurovisione superiore 36 m |
| Thalendir | `thalendir` | `thalendir123` | `adventurer` | `+2` | scurovisione |
| Ragnar | `ragnar` | `ragnar123` | `adventurer` | `+2` | vantaggio fisso all'iniziativa |
| Hunter | `hunter` | `hunter123` | `adventurer` | `+3` | movimento su muri e soffitti |
| Sylas Elveris | `sylas` | `sylas123` | `adventurer` | `+3` | darkvision 60 ft |
| Vesuth Ronavior | `vesuth` | `vesuth123` | `adventurer` | `+2` | nessuna scurovisione |

## Avvio locale

```bash
npm install
npm run dev:server
npm run dev
```

Per una sessione live rapida:

```bash
./start-live-session.sh
```

Build di produzione:

```bash
npm run build
```

Preview locale della build:

```bash
npm run preview
```

## Database SQLite e migrazioni

Il database richiede Node.js 22 (la versione del progetto) e viene gestito con `better-sqlite3`. Installa le dipendenze e crea lo schema locale con:

```bash
npm install
npm run db:migrate
```

Per impostazione predefinita il file e `database/database.sqlite`; i file SQLite ausiliari `database.sqlite-wal` e `database.sqlite-shm` sono ignorati da Git. Per usare un percorso diverso, imposta `VTT_DB_PATH` (assoluto oppure relativo alla root del progetto):

```bash
VTT_DB_PATH=./local-data/dev.sqlite npm run db:migrate
```

Se scegli un percorso alternativo dentro il repository, aggiungilo al tuo `.gitignore` locale prima di eseguirlo. I comandi disponibili sono:

```bash
npm run db:make -- create_npc_table
npm run db:migrate
npm run db:status
npm run db:rollback
```

Le migrazioni in `database/migrations/` sono immutabili dopo l'applicazione: per cambiare lo schema crea sempre un nuovo file. `db:rollback` annulla solo l'ultimo batch e va usato per lo sviluppo; prima di operazioni distruttive su dati reali crea un backup SQLite coerente (chiudi le connessioni o usa il backup SQLite) e preferisci una migrazione correttiva.

Le API e le sessioni live continuano a usare lo stato in memoria in questa fase: il server non apre il database finche una feature successiva non ne avra bisogno.

## Struttura del progetto

```text
src/
  components/
  constants/
    board.ts
    characters.ts
  hooks/
    useAnimatedPresence.ts
    useAuthSession.ts
    useBattleMapState.ts
  styles/
    index.css
  types/
    index.ts
  utils/
    api.ts
    board.ts
    dice.ts
    tokens.ts
  App.tsx
  main.tsx
server/
  characters.mjs
  index.mjs
media/
  images/
```

## Architettura

- `src/App.tsx` orchestra login, sidebar, board, modali e stato locale UI.
- `src/constants/characters.ts` contiene il roster frontend usato dal login e dai dettagli personaggio.
- `src/hooks/useAuthSession.ts` gestisce sessione, login e logout.
- `src/hooks/useBattleMapState.ts` carica lo snapshot condiviso, applica ottimismi e riceve aggiornamenti SSE.
- `src/components/Board.tsx` gestisce selezione, drag, zoom, pan e rendering board.
- `src/components/InitiativePanel.tsx` mostra ordine turni, token attivo e controlli `Next`/`Prev`.
- `src/components/Token.tsx` rende i token nascosti come ghost visibili solo al master.
- `src/components/InitiativeRollModal.tsx` applica iniziativa manuale o roll globale del master.
- `src/components/DicePanel.tsx` genera i tiri associandoli al profilo autenticato.
- `server/characters.mjs` definisce il roster lato server.
- `server/index.mjs` espone autenticazione, stato partita, log dadi e stream realtime.

## Realtime e persistenza

- lo stato condiviso della partita vive nel processo Fastify ed e sincronizzato via SSE
- ogni modifica valida genera un nuovo snapshot broadcastato via SSE
- il master puo sospendere la sessione salvando uno snapshot completo su `server/data/last-session.json`
- al riavvio del backend, se esiste uno snapshot salvato, viene ricaricato automaticamente
- i client autenticati restano allineati su:
  - token in mappa
  - log dadi
  - annuncio di inizio combattimento
  - iniziative
  - turno attivo
  - note condivise
- lo zoom della board resta locale per singolo utente

## Permessi

### Master

- puo aggiungere nuovi elementi
- puo modificare o rimuovere elementi esistenti
- puo muovere token e gruppi di token
- puo muovere qualsiasi elemento selezionato, inclusi oggetti e ostacoli disegnati in gruppo
- puo preparare elementi nascosti ai player e renderli visibili quando serve
- puo tirare l'iniziativa per tutti
- puo impostare manualmente l'ordine dei turni
- puo scegliere il token attivo e usare `Next` o `Prev`
- puo avviare il combattimento con un annuncio condiviso

### Adventurer

- puo fare login con il proprio personaggio
- il proprio token player viene spawnato o riallineato in mappa
- puo consultare board, manuale, log dadi e tracker iniziativa
- vede solo gli elementi resi visibili dal master, oltre ai propri token controllati
- puo tirare i dadi con il proprio nome di sessione
- non puo aggiungere, modificare o spostare elementi
- non puo gestire iniziativa o turno attivo

## Configurazione importante

Il roster personaggi non e generico: e condiviso fra frontend e backend.

Se vuoi cambiare personaggi, immagini, spawn, password o metadati, devi aggiornare entrambi questi file:

- `src/constants/characters.ts`
- `server/characters.mjs`

Le password demo sono derivate convenzionalmente da `username + 123`. Se cambi `username`, cambia anche la password attesa.

## Live session con ngrok

Per la procedura completa con `./start-live-session.sh`, tunnel HTTPS e troubleshooting, consulta [HOWITWORKS.md](./HOWITWORKS.md).

## Note tecniche

- il drag e implementato con Pointer Events, non con HTML5 drag and drop
- i dadi usano `crypto.getRandomValues` per il random uniforme
- Ragnar ha il vantaggio gestito automaticamente nel roll iniziativa globale
- le immagini dei personaggi vengono mostrate come sfondo del relativo token
- se non hai mai salvato una sessione, al riavvio il backend parte con una battle map vuota
- dopo modifiche ai profili lato server conviene riavviare `npm run dev:server`

## Documentazione funzionale

Per la guida operativa completa dell'app, consulta [HOWITWORKS.md](./HOWITWORKS.md).
