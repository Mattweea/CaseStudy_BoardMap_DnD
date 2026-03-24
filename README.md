# D&D Battle Map

Web app locale per usare una battle map interattiva di Dungeons & Dragons nel browser.

## Stack

- React 18
- TypeScript
- Vite
- Nessun backend
- Persistenza con `localStorage`

## Funzionalita principali

- Board con griglia navigabile tramite pan, senza limiti pratici di esplorazione
- Zoom con rotellina del mouse
- PG, nemici e oggetti gestiti tramite modali dedicate
- Taglie D&D reali: minuscola, piccola, media, grande, enorme, mastodontica
- Drag and drop con snap alla cella piu vicina
- Evidenziazione della cella target durante il drag
- Localizzazione rapida di un elemento con pulsante a icona occhio
- Salvataggio automatico di elementi, posizioni e zoom
- Dice roller con log risultati
- Tracker iniziativa con tiro o inserimento manuale

## Avvio locale

```bash
npm install
npm run dev
```

Poi apri nel browser l'URL mostrato da Vite, di solito `http://localhost:5173`.

## Struttura progetto

```text
src/
  components/
    Board.tsx
    DicePanel.tsx
    ElementModals.tsx
    InitiativePanel.tsx
    Modal.tsx
    Token.tsx
  constants/
    board.ts
  hooks/
    useBattleMapState.ts
  styles/
    index.css
  types/
    index.ts
  utils/
    board.ts
    tokens.ts
  App.tsx
  main.tsx
```

## Note tecniche

- La board usa una camera virtuale con pan, cosi puoi continuare a esplorare la mappa in qualsiasi direzione.
- Il drag non usa l'HTML5 drag and drop nativo: usa Pointer Events, cosi il calcolo delle coordinate resta coerente anche con zoom e pan.
- Il pan manuale della mappa avviene con `Ctrl + drag`.
- La conversione mouse -> cella passa sempre da:
  1. coordinate viewport
  2. offset rispetto al board rect
  3. compensazione dello zoom
  4. applicazione dell'offset camera
  5. snap su cella con `Math.floor`
- Le taglie seguono l'ingombro standard D&D: grande 2x2, enorme 3x3, mastodontica 4x4.
- Lo stato viene centralizzato in un hook dedicato per tenere leggibili persistenza e operazioni sugli elementi della mappa.
