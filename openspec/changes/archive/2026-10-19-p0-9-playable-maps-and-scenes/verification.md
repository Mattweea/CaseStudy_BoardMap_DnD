# Chiusura P0.9 — 2026-10-19

## Esito della milestone

Le 22 change foglia previste dal proposal sono implementate e verificate. Tutte le attività foglia sono completate; la verifica finale usa l'accettazione UI dell'utente e, separatamente, la prova automatica con server reale, Master e due Player, due scene, stream SSE, migrazione legacy e riavvio. Il refactoring degli encounter resta rimandato per scelta dell'utente.

Le evidenze dettagliate sono conservate in:

- [Verifica integrata D.4](../2026-10-19-p0-9d-4-integration-multiclient-verification/verification.md).
- [Collocazione delle figure E.4](../2026-10-19-p0-9e-4-encounter-placement/verification.md).
- [Persistenza della preparazione E.5](../2026-10-19-p0-9e-5-encounter-persistence/verification.md).
- [Seguito camera](../2026-10-19-follow-player-movement-camera/verification.md), modifica di supporto accettata durante P0.9.

## Validazione e sincronizzazione

- Le verifiche strict sono registrate nei task delle singole foglie. Prima della chiusura sono rivalidate tutte le 22 directory, comprese quelle già archiviate, tramite `Validator(true).validateChangeDeltaSpecs` della CLI OpenSpec installata, con i medesimi parametri di radice e specifiche canoniche del comando `openspec validate`. Esito: 22 valide, nessuna attività foglia aperta. Questa rivalidazione attuale non è presentata come una nuova esecuzione storica prima dell'implementazione.
- `openspec validate --all --strict --no-interactive`, prima dell'archiviazione: 24 elementi validi.
- Le delta implementate sono già sincronizzate nelle 18 capability canoniche. Il confronto dei cinque requisiti finali delle change ancora attive coincide con le specifiche correnti: E.3 è seguito dall'aggiornamento esplicito introdotto da E.4, quindi da E.5; sono inclusi anche D.4 e la camera. Non viene ripristinata la formulazione E.3 precedente ai placement.
- Nessuna modifica al codice applicativo dopo la verifica integrata del commit `b5cdefa`: 337 test passati senza skip, build superata e controllo documentale superato. L'avviso Vite sul chunk DiceBox superiore a 500 kB resta una limitazione di bundle preesistente.
- L'archiviazione conserva le specifiche canoniche e sposta le directory completate con tutti i loro artefatti e metadati; la change di coordinamento viene archiviata per ultima. I collegamenti relativi tra le evidenze sono aggiornati ai percorsi datati.
- Dopo lo spostamento: 25 directory archiviate correlate valide e senza task aperti (22 foglie, supporto ai confini board, camera e coordinamento); `openspec list --json` non elenca change attive. `openspec validate --all --strict --no-interactive` passa sulle 18 capability, `npm run docs:check` passa sui 22 artefatti instradati e `git diff --check` passa. Un confronto degli hash verifica che lo spostamento conservi tutti i file; i collegamenti Markdown locali delle sei directory spostate sono validi.

## Confini della consegna

P0.9 consegna catalogo scene, sfondi e calibrazione, griglia e buio per scena, drawing e arredi, transizioni e trasferimento del party, mostri/PNG con placement e persistenza della preparazione. I filtri Player correnti non equivalgono alla segretezza server-side prevista da P0.10. Il recupero automatico dell'ultimo stato live completo, incluse le scene inattive, resta P0.11; il riavvio riparte dai valori preparati delle figure.

Non è stata eseguita dall'agente una nuova prova visiva nel browser: l'accettazione UI dell'utente rimane distinta dalle prove HTTP/SSE e dai test componenti con hook/geometria simulati. Database, asset e processi della partita corrente non sono stati modificati.
