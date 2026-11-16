# Tasks

## 1. Sei passaggi e composizione degli editor

- [ ] 1.1 Separare il CRUD degli incontri dai form figure/placement, inserire Mostri e PNG prima di Riepilogo e aggiornare avanti/indietro, accesso diretto e focus. Verificare «Percorso di preparazione navigabile» con test di componente e nel verificatore browser: sei passaggi nell'ordine richiesto, creazione encounter seguita dal nuovo passaggio e scena senza incontri che raggiunge il riepilogo.
- [ ] 1.2 Aggiungere il selettore esplicito degli encounter salvati e gli stati senza selezione/senza incontri, filtrando figure e collocazioni. Verificare «Selezione dell'encounter per mostri e PNG» con due encounter: form non disponibili prima della scelta, creazione di un mostro e di un PNG in A, assenza di quelle figure in B, recupero di figure già persistite e azzeramento su cambio scena o selezione rimossa.
- [ ] 1.3 Spostare l'interattività del portal nel nuovo passaggio mantenendo quantità, modifica, schede e coordinate della preview. Verificare che l'uscita annulli il gesto senza scritture e che Encounter non intercetti la preview; eseguire i test placement esistenti e aggiornare i relativi casi in `tools/verify-scene-wizard.mjs`.
- [ ] 1.4 Aggiornare `Docs/ai/frontend/frontend_architecture.md` e `HOWITWORKS.md` per ordine dei passaggi e destinazione degli editor; verificare coerenza con i controlli consegnati e superamento di `npm run docs:check`.

## 2. Bozze e riepilogo

- [ ] 2.1 Collegare il cambio encounter alla guardia delle bozze senza cambiare l'ID prima del completamento dell'azione scelta. Verificare «Bozze e salvataggi espliciti» con test di salvataggio in A prima del passaggio a B, scarto senza scritture, permanenza con bozza intatta, salvataggio fallito e conflitto che non avanzano; provare anche bozza figura e bozza placement salvate in sequenza con le versioni correnti.
- [ ] 2.2 Separare conteggi e collegamenti di Encounter e Mostri e PNG nel riepilogo, mantenendo i comandi espliciti di attivazione e trasferimento. Verificare «Riepilogo e attivazione separati» nel browser con due incontri, tre figure e cinque istanze, ritorno a entrambi gli step, preparazione privata senza attivazione e rifiuto di una preview trasferimento obsoleta.
- [ ] 2.3 Integrare nei contratti frontend e nella guida la protezione delle bozze e le voci del riepilogo; eseguire `npm run docs:check` e `git diff --check` prima di considerare completato il gruppo.

## 3. Verifica integrata della modifica

- [ ] 3.1 Eseguire `npm run build`, `npm test` e `openspec validate wizard-monsters-and-npcs-step --strict --no-interactive`; riportare esiti ed eventuali limiti d'ambiente. I test di persistenza e server devono usare soltanto database, storage e processi temporanei secondo la documentazione operativa.
- [ ] 3.2 Eseguire il verificatore wizard aggiornato con Playwright su server e storage isolati: creazione encounter → scelta nel nuovo step → PNG/mostro → quantità e collocazione → scheda → riepilogo, con finestra ampia e stretta. Verificare anche che il Player non acceda al wizard e non riceva preparazione inattiva. Confrontare esplicitamente gli scenari del delta con i risultati prima di dichiarare la modifica pronta per archivio.
