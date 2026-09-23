## Verifica automatica

- `node --test test/dice-presentation-preferences.test.mjs test/dice-roll-audio.test.mjs test/dice-3d-presentation.test.mjs`: superato.
- `npm test`: 20 file di test superati.
- `npm run build`: typecheck e build Vite superati; resta il warning informativo già noto sul chunk lazy del renderer maggiore di 500 kB.
- `npm run docs:check`: superato, 22 artefatti raggiungibili dal macro-router.
- `git diff --check`: superato.
- `openspec validate p0-6c-dice-controls-and-audio --strict --no-interactive`: change valida.

## Verifica manuale

Completata nel browser con backend e frontend attivi:

- click primario ed `Esc` interrompono rotolamento e riepilogo senza perdita del log né blocco del controllo attivato;
- i toggle animazione/audio sono separati, persistono dopo reload e restano indipendenti fra client;
- disabilitare l'animazione durante un tiro interrompe corrente e coda, mentre la riattivazione vale soltanto per i nuovi tiri;
- `prefers-reduced-motion` mantiene il solo risultato numerico senza modificare la preferenza salvata;
- l'audio resta silenzioso prima del gesto, si sente nei tiri futuri dopo il gesto e torna silenzioso quando disabilitato;
- con asset audio inizialmente non servito, animazione, log e controlli sono rimasti operativi; dopo il riavvio del frontend l'asset locale e la sequenza dei dadi risultano udibili;
- due client mantengono preferenze indipendenti e la visibilità dei tiri pubblici/segreti resta invariata.
