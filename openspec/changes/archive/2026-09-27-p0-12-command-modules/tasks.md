## 1. Catalogo dei moduli

- [x] 1.1 Spostare `STAND_UP_ACCESS_KEY` e `AURAS_ACCESS_KEY` da `TokenRadialMenu.tsx` a `src/utils/tokens.ts` ed esportarli accanto a `CONDITION_ACCESS_KEYS`; `TokenRadialMenu.tsx` li importa (design, decisione 2). Verifica: `npm run build`; manuale, `S` poi `L` e `U` sul proprio token si comportano come prima.
- [x] 1.2 Creare `src/constants/commandModules.ts` con tipi, `COMMAND_MODULES` e `commandModulesFor(role)` (design, decisione 1). La riga delle condizioni di creature e veicoli si genera da `CONDITION_ACCESS_KEYS`, `conditionLabel` e `conditionCatalogFor` (design, decisione 2). Verifica: `npm run build`.
- [x] 1.3 Scrivere il contenuto dei dieci moduli a partire dal codice, non dalla vecchia legenda (design, decisione 8), e annotare nel riepilogo del task l'origine di ogni voce: costante, gestore o `aria-label`. Coprire almeno:
  - Mappa e visuale: rotella e pulsanti `+`/`−`, `Ctrl`+trascina e tasto centrale, click per selezionare, `Shift`+click e riquadro per il Master, Full screen, Elementi in mappa, Averno, Manuale, «Localizza» nella tab Personaggi, blocco della sidebar;
  - Movimento: click sul token per aprire il piano, click per i punti intermedi, `Spazio` conferma sulla casella sotto il puntatore, `Backspace` toglie l'ultimo punto, `Esc` o click destro annullano; per il Player frecce/WASD/`Home`/`PgUp`/`End`/`PgDn` sul proprio PG, pad, `-1`/`+1`, Scatto e annullamento della propria ultima azione con `Ctrl+Z`; per il Master frecce/WASD sui token selezionati, spostamento di gruppo e di ostacoli, regola delle diagonali e unità di misura;
  - Strumenti di misura: `R`, `P`, `C`, `O`, `L`, `Esc`, inerti mentre si scrive o durante un'interazione;
  - Combattimento e iniziativa: controlli reali di `InitiativePanel` per ruolo, fra cui Avvia/Termina combattimento, Gestisci voci, turno precedente e successivo, riordino e rimozione, aggiunta dei selezionati per il Master, «Termina il mio turno» quando consentito e tiro d'iniziativa per il Player;
  - Dadi: vassoio cumulativo e limite `d20`, modificatore, Pubblico/Segreto, `/r` e `/rs` con Invio, formule e limiti supportati, click o `Esc` per saltare il 3D, preferenze in Impostazioni;
  - Condizioni: click destro, `S`, `Shift+F10`, frecce e `Invio`/`Spazio`, tasti d'accesso generati, `+` per altre condizioni, `L` Alzati con costo, Prono tolto senza costo, `0`-`6`, `Esc`;
  - Aure: `U` e pannello; per il Player il pannello delle aure altrui con «Mostra dettagli»;
  - Punti ferita: icona e `-`/`+` nel menu, `Invio`/`Esc`, e i punti ferita dalla scheda;
  - Scheda personaggio: «Apri scheda», trascinamento e `Alt`+frecce, «Tiri: Pubblici/Segreti», tiri dalla scheda, e per il Master l'accesso a ogni scheda;
  - Gestione della mappa, solo Master: card Azioni, `Canc`/`Backspace` e cestino sui selezionati, Invisibile, luci, sfondo, posa ostacolo, `Ctrl+Z` globale.

  Verifica: revisione voce per voce contro il codice; nessuna voce senza origine.
- [x] 1.4 Aggiungere `test/command-modules.test.mjs` per verificare:
  - ordine e id dei moduli;
  - `commandModulesFor('player')` senza «Gestione della mappa» e senza voci `master`;
  - `commandModulesFor('master')` con tutti i moduli e senza voci `player`;
  - nessun modulo o sezione vuoti dopo il filtro;
  - ogni tasto di `CONDITION_ACCESS_KEYS`, `L`, `U`, `0`-`6`, `-`, `+`, `S` e `Shift+F10` presente nei moduli Condizioni, Aure e Punti ferita per entrambi i ruoli;
  - `R`, `P`, `C`, `O` e `L` presenti in Strumenti di misura;
  - `/r` e `/rs` presenti in Dadi;
  - nessuna voce `+` con testo che menzioni la card Azioni.

  Verifica: `npm test`.

## 2. Interfaccia

- [x] 2.1 Creare `src/components/CommandModules.tsx`: elenco di pulsanti con icona, titolo e riassunto; un `Modal` con sezioni e liste `dl`/`kbd`; fuoco sull'intestazione all'apertura e ritorno al pulsante alla chiusura (design, decisioni 3-4). Verifica: `npm run build`; manuale, apertura con mouse e con `Invio`, chiusura con `Esc`, `×` e sfondo, con il fuoco che torna al modulo.
- [x] 2.2 Aggiungere a `CommandModules` il listener `keydown` in cattura su `window`, attivo solo a modale aperta, che interrompe tutto tranne `Escape` e `Tab` senza `preventDefault` (design, decisione 5). Verifica: manuale come Adventurer con il proprio token, a modale aperta: freccia destra, `W`, `R`, `S`, `Spazio` e `Ctrl+Z` non hanno effetto; `Tab` e `Invio` sul pulsante di chiusura funzionano; dopo la chiusura le stesse scorciatoie tornano ad agire. Come Master con token selezionati, `Canc` a modale aperta non li rimuove.
- [x] 2.3 In `App.tsx`, rinominare la tab in «Moduli» e l'id da `legend` a `modules` in `WorkspaceTabId`/`SidebarSectionId`, e sostituire il `case 'legend'` con `<CommandModules role=… />`, rimuovendo gli import rimasti inutilizzati (design, decisione 6). Verifica: `npm run build`; manuale, tab raggiungibile da tastiera con nome accessibile «Moduli» e cinque tab su una riga alla larghezza nominale.
- [x] 2.4 Sostituire `.command-legend*` con gli stili `.command-modules*` e della modale in `src/styles/index.css`, con `max-height`, scroll interno e `overflow-wrap` (design, decisione 7). Verifica: manuale, modulo Condizioni leggibile per intero a 360 px di larghezza e su desktop; nessun testo troncato nell'elenco con il pannello a larghezza nominale.

## 3. Verifica e documentazione

- [ ] 3.1 Verifica manuale contro gli scenari delle due delta spec, come Master e come Adventurer in due browser: elenco per ruolo, «Strumenti di misura» da tastiera, ritorno del fuoco, tasti inerti, «Movimento» diverso per ruolo, testo lungo leggibile, nessun comando superato, moduli Condizioni/Aure/Punti ferita completi, overlay su schermo stretto.
- [x] 3.2 Valutare l'impatto su `Docs/ai`. In `Docs/ai/frontend/frontend_architecture.md` aggiungere la regola: il catalogo `commandModules` è la guida in-app; chi aggiunge, toglie o cambia un comando lo aggiorna nella stessa change, e i tasti derivabili da una costante si derivano. Verificare che `board_interaction_and_visibility.md` non citi la «legenda». Verifica: `npm run docs:check` e `git diff --check`.
- [x] 3.3 Controlli finali: `npm run build`, `npm test` e `openspec validate p0-12-command-modules --strict --no-interactive`.
- [x] 3.4 All'archiviazione spuntare in `FEATURES_VTT.md` la voce P0.12 della «Legenda dei comandi», riformulata come «Moduli», e aggiornare lo «Stato attuale» di P0.12. `HOWITWORKS.md` resta fuori perimetro e la sua voce resta aperta. Verifica: diff di `FEATURES_VTT.md`.
