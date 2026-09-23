## 1. Preferenze locali

- [x] 1.1 Introdurre un modello versionato per `animationEnabled` e `soundEnabled`, con parsing atomico, default entrambi attivi e fallback per dati assenti o corrotti; verificare con test Node default, round trip e payload invalidi/versioni sconosciute.
- [x] 1.2 Implementare il hook locale che inizializza le preferenze senza errori anche quando lo storage non è disponibile e persiste ogni modifica senza coinvolgere `BattleMapSharedState`; verificare tramite test delle funzioni iniettate e `npm run build`.
- [x] 1.3 Comporre le preferenze una sola volta in `App` e passarle a pannello e overlay; verificare dal diff e con build/typecheck che non siano stati aggiunti campi, endpoint o mutazioni condivise.

## 2. Interruzione e coda

- [x] 2.1 Estendere il controller FIFO con un'operazione che scarti gli elementi pendenti conservandone la deduplica, senza interrompere implicitamente l'elemento corrente; verificare con test su ordine, salto del corrente, scarto dei pendenti, riattivazione e id già visti.
- [x] 2.2 Unificare in `Dice3DOverlay` il percorso idempotente di interruzione e collegarlo a `Escape` e click primario soltanto negli stati attivi, senza consumare eventi o modificare il focus; verificare con test della logica estratta e manualmente su board, pannello, modale e scheda.
- [x] 2.3 Applicare `animationEnabled` prima di inizializzare il renderer e, quando passa a `false`, interrompere il tiro corrente e scartare i pendenti lasciando i nuovi log come risultati numerici; verificare con test della coda e manualmente disabilitazione durante rotolamento e riepilogo.
- [x] 2.4 Conservare la precedenza di `prefers-reduced-motion` senza sovrascrivere la preferenza personale; verificare con i test di capability esistenti e manualmente che il ritorno a `no-preference` rispetti ancora il toggle salvato.

## 3. Audio sicuro e asset locali

- [x] 3.1 Estendere `tools/copy-dice-assets.mjs` per copiare deterministicamente i soli campioni `dicehit`/`surface` referenziati oltre alle texture, aggiornando il messaggio operativo; verificare eseguendo `npm run assets:dice` e controllando la presenza dei file attesi sotto `public/dice-box/sounds`.
- [x] 3.2 Implementare un adapter audio locale cancellabile con dipendenze browser iniettate, riproduzione subordinata a preferenza e gesto utente e isolamento di errori/rejection; verificare con test Node su gate, sequenza, stop e `play()` fallita.
- [x] 3.3 Rilevare una sola volta il primo `pointerdown` o `keydown` attendibile e integrare l'adapter nel ciclo del tiro senza ritardare né rigettare la Promise del renderer; verificare manualmente un tiro prima del gesto, uno successivo e l'assenza di playback retroattivo.
- [x] 3.4 Fermare audio e timer su salto, disabilitazione, movimento ridotto, errore o pulizia finale; verificare con fault injection che un asset mancante o audio negato lasci animazione, coda e log operativi.

## 4. Controlli e documentazione

- [x] 4.1 Aggiungere nel dock di `DicePanel` due controlli accessibili e indipendenti per animazione e audio, mantenendo utilizzabili selezione, comando `/r` e modale del tiro; verificare con tastiera, screen reader semantics e viewport compatto senza overflow.
- [x] 4.2 Aggiornare la legenda con i comandi di salto e valutare l'impatto documentale routed; aggiornare `Docs/ai/frontend/frontend_architecture.md`, `Docs/ai/frontend/board_interaction_and_visibility.md` e `Docs/ai/operations/development_and_live_session.md` con ownership, fallback e asset riusabili, quindi verificare con `npm run docs:check`.

## 5. Verifica integrata

- [x] 5.1 Eseguire i test mirati delle preferenze, della coda e dell'audio, poi `npm test`, `npm run build`, `npm run docs:check`, `git diff --check` e `openspec validate p0-6c-dice-controls-and-audio --strict --no-interactive`; correggere ogni regressione prima di completare la change.
- [x] 5.2 Verificare manualmente e registrare in `verification.md`: click ed `Esc` durante rotolamento/riepilogo senza perdita del log o blocco del controllo attivato; persistenza separata dei due toggle dopo reload; movimento ridotto; audio silenzioso prima del gesto, sonoro dopo il gesto e silenzioso quando disabilitato; errore audio non bloccante; indipendenza delle preferenze fra due client e privacy invariata per tiri pubblici e segreti.
