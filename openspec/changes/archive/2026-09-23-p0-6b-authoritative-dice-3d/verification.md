## Verifica automatica

- `npm test`: 18 file di test superati, inclusi adapter autorevole, d100, gruppi e disposizioni, limite/fallback, baseline e deduplica, FIFO, timeout, fault isolation e capability WebGL/movimento ridotto.
- `npm run build`: type-check e build Vite superati; DiceBox è prodotto come chunk lazy separato e le texture locali vengono rigenerate dal `prebuild`.
- `npm run docs:check`: grafo documentale valido, 22 artefatti raggiungibili.
- `git diff --check`: nessun errore di whitespace.
- `openspec validate p0-6b-authoritative-dice-3d --strict --no-interactive`: change valida.

## Verifica manuale

Eseguita dall'utente il 23 settembre 2026 su backend e frontend locali attivi:

- `2d6+1`: log immediato, due modelli e facce finali coerenti con il dettaglio autorevole;
- due tiri ravvicinati: animazioni FIFO, una sola volta per id;
- privacy: tiro segreto visibile ad autore e Master, assente su un altro Player; tiro pubblico condiviso;
- vantaggio/svantaggio: entrambi i d20 presenti, `kept` evidenziato e `discarded` attenuato;
- tiro d20 da scheda: coppia `unresolved` con enfasi paritaria;
- danno da scheda con due blocchi: tutti i dadi presenti e gruppi distinti;
- d100: coppia percentile coerente con il valore logico; i casi `7`, `40` e `100` sono coperti anche dai test tabellari;
- ingresso/uscita fullscreen durante il tiro: nessuna duplicazione; zoom, drag, controlli e focus restano utilizzabili;
- ricaricamento con cronologia: nessuna rianimazione dei log esistenti;
- viewport stretta: scena e result rail restano confinati alla board;
- `prefers-reduced-motion: reduce`: solo risultato numerico; tornando a `no-preference` le animazioni future riprendono.

## Accessibilità e fallback

L'overlay è `aria-hidden`, non contiene controlli focalizzabili, non aggiunge live region e usa `pointer-events: none`; la verifica manuale ha confermato che non sottrae focus né blocca le interazioni. WebGL assente, dettaglio legacy/malformato, limite superato ed errore/timeout del renderer degradano al log numerico; i rami deterministici sono coperti dai test automatici perché il progetto non dispone di un runner DOM/WebGL.

## Note non bloccanti

- Il selettore rapido supporta un solo tipo di dado per tiro; il click destro decrementa la quantità. La scarsa visibilità di questa interazione, soprattutto per touch e tastiera, è un miglioramento separato dal perimetro P0.6b.
- Il result rail mostra `Gruppo 1` anche per un singolo gruppo: corretto semanticamente ma ridondante; l'eventuale semplificazione è cosmetica e separata.
- `npm audit --omit=dev` segnala vulnerabilità runtime preesistenti nella catena Fastify/fast-uri; la nuova dipendenza DiceBox/ThreeJS non compare fra i pacchetti segnalati.
