# D&D Battle Map

Applicazione web per gestire una battle map di Dungeons & Dragons con sessione condivisa tra piu utenti.

Questo repository va letto come un **case study React + TypeScript + Fastify**: l'obiettivo non e solo offrire una mappa interattiva per il Dungeon Master, ma mostrare anche come strutturare un frontend con stato condiviso server-side, ruoli utente e sincronizzazione realtime leggera.

## Obiettivo del progetto

Il progetto mette insieme tre aree in un'unica interfaccia:

- gestione della mappa tattica
- gestione di elementi, mezzi e occupanti
- strumenti di supporto al DM come dice roller, log tiri e tracker iniziativa

## Stack

- React 18
- TypeScript
- Vite
- Fastify
- CSS custom
- autenticazione via cookie di sessione
- sincronizzazione realtime via Server-Sent Events
- persistenza locale solo per lo zoom utente

## Perche è un case study React TypeScript

Il progetto e utile come riferimento pratico per:

- organizzazione di uno state container custom con hook dedicato
- modellazione di tipi TypeScript per token, mezzi, iniziativa e dadi
- gestione di drag, selezione e pan tramite Pointer Events
- modali e pannelli coordinati senza librerie esterne
- sincronizzazione e normalizzazione dei dati tra client e server
- separazione tra `components`, `hooks`, `utils`, `types` e `constants`

## Funzionalita coperte

- board virtuale con griglia navigabile
- zoom progressivo con wheel
- selezione singola, multiselezione e selezione ad area
- drag and drop di uno o piu elementi con snap a griglia
- gestione di PG, nemici, oggetti e mezzi
- supporto ai mezzi con occupanti e sincronizzazione delle posizioni
- aggiunta, modifica, rimozione e localizzazione rapida degli elementi
- tracker iniziativa con ordinamento, drag reorder sui pareggi e token attivo
- dice roller con vantaggio, svantaggio, modificatori, log e reveal animato del risultato
- apertura del manuale in preview embedded dentro modale
- login con ruolo `master` o `adventurer`
- sessione condivisa con aggiornamento live di mappa, iniziativa e log tiri

## Avvio locale

```bash
npm install
npm run dev:server
npm run dev
```

Per una sessione live rapida con un solo comando:

```bash
./start-live-session.sh
```

Credenziali demo:

- `master` / `master123`
- `aria` / `adventurer123`
- `borin` / `adventurer123`

Build di produzione:

```bash
npm run build
```

Preview locale della build:

```bash
npm run preview
```

Per una sessione live rapida con ngrok, inclusa la procedura con `./start-live-session.sh`, consulta la sezione dedicata in [HOWITWORKS.md](./HOWITWORKS.md).

## Struttura del progetto

```text
src/
  components/
    Board.tsx
    DiceIcons.tsx
    DiceLogModal.tsx
    DicePanel.tsx
    DiceResultModal.tsx
    ElementModals.tsx
    InitiativePanel.tsx
    InitiativeRollModal.tsx
    Modal.tsx
    Token.tsx
  constants/
    board.ts
  hooks/
    useAnimatedPresence.ts
    useAuthSession.ts
    useBattleMapState.ts
  styles/
    index.css
  types/
    index.ts
  utils/
    board.ts
    dice.ts
    tokens.ts
  App.tsx
  main.tsx
server/
  index.mjs
media/
  images/
```

## Architettura in breve

- `App.tsx` orchestra login, sidebar, board, modali e overlay.
- `useAuthSession.ts` gestisce sessione, login e logout.
- `useBattleMapState.ts` legge e aggiorna lo stato condiviso tramite API + SSE.
- `Board.tsx` gestisce camera, zoom, drag, pan e selezione.
- `ElementModals.tsx` incapsula creazione, modifica e lista degli elementi.
- `utils/tokens.ts` contiene preset e regole di dominio per token e mezzi.
- `utils/dice.ts` contiene la logica dei tiri e il generatore casuale uniforme.
- `server/index.mjs` espone auth, stato condiviso e stream realtime.

## Documentazione funzionale

Per una spiegazione operativa completa di tutte le funzionalita della mappa, consulta [HOWITWORKS.md](./HOWITWORKS.md).

## Note tecniche

- La mappa usa una camera virtuale, quindi non e limitata a un'unica schermata fissa.
- Il drag e implementato con Pointer Events, non con HTML5 drag and drop.
- I mezzi mantengono coerenti occupanti, affiliazione e posizione tramite normalizzazione lato stato.
- Il random dei dadi usa `crypto.getRandomValues`, cosi ogni faccia valida ha probabilita uniforme.
- Il manuale viene visualizzato tramite preview embedded di Google Drive dentro una modale.
- Lo stato della partita e mantenuto in memoria nel server Fastify.
- Il ruolo `master` puo modificare la battle map; `adventurer` ha accesso in sola consultazione.
- Solo lo zoom resta locale per utente tramite `localStorage`.
