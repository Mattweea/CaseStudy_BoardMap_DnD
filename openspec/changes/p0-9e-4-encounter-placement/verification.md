# Verifica E.4 — 2026-10-19

## Risultati automatici

- `npm test`: 48 file di suite passati, nessun fallimento.
- `test/encounter-placement.test.mjs`: 5 scenari per riferimenti/geometria, autorizzazione, concorrenza, singolo aggiornamento realtime, visibilità Master/Player, collisioni, errore SQLite, separazione configurazione/runtime e attivazione di scene inattive. I database sono temporanei; la partita corrente non è stata modificata.
- `test/encounter-placement-ui.test.mjs`: 3 scenari sul componente reale con hook e geometria controllati: payload del form, conversione da coordinate mostrate da 1 a coordinate da 0, trascinamento nella preview trasformata con un solo commit, esclusione degli strumenti scenici, pan/drawing e annullamento senza scritture.
- `npm run build`: superato. Resta l'avviso Vite preesistente sul chunk DiceBox superiore a 500 kB.
- `npm run docs:check`: superato, 22 artefatti raggiungibili.
- `git diff --check`: superato.
- `openspec validate p0-9e-4-encounter-placement --strict --no-interactive`: superato.

## Confronto con la delta

| Scenario | Evidenza |
|---|---|
| Placement preparato | Create/update/remove delle route, ID e link stabili, materializzazione su scena attiva e all'attivazione di una scena preparata |
| Separazione dagli elementi | Componente dedicato con figura, geometria e visibilità; nessun controllo di rotazione o blocco visuale degli arredi |
| Nascosto corrente | Test delle viste sanitizzate: Master conserva l'istanza nascosta, Player non riceve il token; un update visibile lo ripubblica con lo stesso ID |
| Confine P0.10 | Riutilizzata la sanitizzazione corrente dei token; nessuna nuova garanzia di filtraggio completo dei segreti/fog. Contratto esplicito nei leaf frontend/backend/gameplay |
| Autorizzazione e concorrenza | POST/PATCH/DELETE rifiutano anonimi/Player; versione obsoleta restituisce 409 senza pubblicazione |
| Scrittura non riuscita | Riferimenti invalidi, fuori board, collisioni e failure injection lasciano scena, versione e runtime invariati |
| Preparazione distinta dal gioco | Riconciliazione per differenze: HP/condizioni/posizione live sopravvivono a modifiche estranee e al cambio scena; la configurazione iniziale resta separata |

## Accettazione utente — 2026-10-19

L'utente conferma che mostri e PNG funzionano e possono essere collocati tranquillamente, e chiede di procedere rimandando la semplificazione degli encounter. Il task 4.1 è chiuso sulla base di questa accettazione e dei test automatici indicati sopra. Non si attribuisce all'agente una nuova sessione browser: i controlli UI automatici usano hook e geometria simulati.

Percorso da provare: Preparazione scena → selezione encounter → aggiunta/selezione mostro o PNG → «Figure sulla mappa» → scegliere figura, colonna/riga e visibilità → «Colloca figura». Sulla scena attiva il token compare sulla board; una scena inattiva conserva la preparazione fino all'attivazione. Provare poi trascinamento nella preview, resize dal form, hidden e rimozione con Master/Player e fullscreen.

La verifica del riavvio e del recupero della configurazione encounter è documentata separatamente in [E.5](../p0-9e-5-encounter-persistence/verification.md). L'accettazione di E.4 riguarda la collocazione; non dichiara completato il recovery live P0.11.
