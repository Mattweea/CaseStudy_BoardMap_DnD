## 1. Diritti e asset

- [x] 1.1 Verificare il permesso del titolare per l'uso dei due audio esatti e la consegna ai browser nell'app; registrare fonte, titolare e obblighi applicabili senza dati privati. Verifica: il permesso copre entrambi i file e la nota di provenienza è presente; in caso contrario fermare la sostituzione.
- [x] 1.2 Preparare i due file locali in un formato browser supportato, controllandone identità, durata, riproducibilità e volume percepito. Verifica: entrambi gli asset vengono caricati e riprodotti localmente e corrispondono ai due riferimenti scelti.

## 2. Mappatura e attribuzione

- [x] 2.1 Sostituire la mappatura di `combat-start` con il primo asset e far puntare `turn-next` e `turn-now` allo stesso secondo asset, preservando preferenze, interazione affidabile e fallimento silenzioso. Verifica: controllo mirato della mappatura e `npm run build` riuscito.
- [x] 2.2 Aggiornare l'attribuzione nella tab Impostazioni secondo il permesso verificato. Verifica: la tab contiene fonte e attribuzione corrette, senza dichiarare CC0.
- [x] 2.3 Aggiornare la frase sugli asset CC0 in `Docs/ai/gameplay/combat_movement_and_dice.md`. Verifica: `npm run docs:check` e `git diff --check` riusciti.
- [x] 2.4 Includere i due MP3 nel bundle senza file audio pubblici separati. Verifica: nel build sono presenti due URI audio, gli MP3 sorgente mantengono i loro hash e `dist/media/audio/` non contiene i campioni autorizzati.

## 3. Verifica del comportamento

- [x] 3.1 Con audio abilitato dopo interazione, verificare manualmente ingresso in combattimento, «Sei il prossimo!» e «Tocca a te!» su Master e Adventurer: il primo usa il campione d'ingresso, gli altri due lo stesso campione di turno, una sola volta per evento. La verifica manuale è necessaria per confermare l'identità udibile dei file.
- [x] 3.2 Verificare silenziamento, volume zero, ricarica/riconnessione, riproduzione negata dal browser e un tiro per colpire con risultato critico o uno: gli avvisi visivi restano presenti, la cronologia non riparta e il tiro non genera un suono di combattimento aggiuntivo. Verifica: controllo manuale dei casi e, se si tocca logica condivisa, test automatici mirati.
- [x] 3.3 Eseguire `openspec validate user-selected-combat-sounds --strict --no-interactive`, `npm run build` e gli altri controlli richiesti dalle modifiche effettive. Verifica: comandi riusciti e confronto finale di ogni scenario della delta spec con il comportamento osservato.
