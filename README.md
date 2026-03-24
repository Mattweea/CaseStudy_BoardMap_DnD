# D&D Battle Map

Applicazione web locale per gestire una battle map di Dungeons & Dragons direttamente nel browser.

Questo repository va letto come un **case study React + TypeScript**: l'obiettivo non e solo offrire una mappa interattiva per il Dungeon Master, ma mostrare anche come strutturare un'app frontend con stato centralizzato, componenti separati, logica domain-driven e persistenza locale senza backend.

## Obiettivo del progetto

Il progetto mette insieme tre aree in un'unica interfaccia:

- gestione della mappa tattica
- gestione di elementi, mezzi e occupanti
- strumenti di supporto al DM come dice roller, log tiri e tracker iniziativa

## Stack

- React 18
- TypeScript
- Vite
- CSS custom
- Persistenza locale con `localStorage`
- Nessun backend

## Perche è un case study React TypeScript

Il progetto e utile come riferimento pratico per:

- organizzazione di uno state container custom con hook dedicato
- modellazione di tipi TypeScript per token, mezzi, iniziativa e dadi
- gestione di drag, selezione e pan tramite Pointer Events
- modali e pannelli coordinati senza librerie esterne
- persistenza e normalizzazione dei dati lato client
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
- persistenza automatica di zoom, elementi, iniziativa e log tiri

## Avvio locale

```bash
npm install
npm run dev
```

Build di produzione:

```bash
npm run build
```

Preview locale della build:

```bash
npm run preview
```

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
media/
  images/
```

## Architettura in breve

- `App.tsx` orchestra sidebar, board, modali e overlay.
- `useBattleMapState.ts` centralizza tutte le operazioni sullo stato persistito.
- `Board.tsx` gestisce camera, zoom, drag, pan e selezione.
- `ElementModals.tsx` incapsula creazione, modifica e lista degli elementi.
- `utils/tokens.ts` contiene preset e regole di dominio per token e mezzi.
- `utils/dice.ts` contiene la logica dei tiri e il generatore casuale uniforme.

## Documentazione funzionale

Per una spiegazione operativa completa di tutte le funzionalita della mappa, consulta [HOWITWORKS.md](./HOWITWORKS.md).

## Note tecniche

- La mappa usa una camera virtuale, quindi non e limitata a un'unica schermata fissa.
- Il drag e implementato con Pointer Events, non con HTML5 drag and drop.
- I mezzi mantengono coerenti occupanti, affiliazione e posizione tramite normalizzazione lato stato.
- Il random dei dadi usa `crypto.getRandomValues`, cosi ogni faccia valida ha probabilita uniforme.
- Il manuale viene visualizzato tramite preview embedded di Google Drive dentro una modale.
- I dati vengono recuperati e normalizzati da `localStorage` all'avvio.
