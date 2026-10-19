## Context

`src/App.tsx` riproduce già gli avvisi di ingresso e turno tramite `playCombatSound`, con preferenze locali di silenziamento e volume. `src/utils/combatAudio.ts` associa oggi tre eventi a tre file `.ogg` locali. Il contratto canonico richiede asset ridistribuibili; i link a 101soundboards sono riferimenti ai campioni scelti, ma la disponibilità pubblica del download non dimostra il diritto di incorporarli nell'app.

## Goals / Non-Goals

**Goals:**

- Mantenere l'architettura audio locale esistente e cambiare solo l'identità dei campioni e la mappatura dei due avvisi di turno.
- Rendere tracciabile il permesso che copre l'uso e la ridistribuzione prima di aggiungere i file.

**Non-Goals:**

- Nessuna scelta del campione da parte dei singoli partecipanti.
- Nessuna nuova classificazione dei due d20 del tiro per colpire e nessun suono per i critici.

## Decisions

### Asset locali dopo verifica dei diritti

Prima di scaricare o incorporare i due campioni, verificare che il permesso fornito dal titolare identifichi i file e copra la consegna ai browser nell'app. Conservare nel repository una nota di provenienza e attribuzione con la fonte e gli obblighi applicabili, senza pubblicare eventuali dati privati presenti nel permesso. I due file di origine sono MP3 riproducibili nel browser: conservarli nel formato originale, senza conversione, e registrarne la fonte nella tab Impostazioni. Collocarli in `src/assets/audio/` e forzarne l'inclusione nel bundle di produzione tramite Vite, così non sono pubblicati con URL di asset separati. Se il permesso manca o non copre la consegna nell'app, fermare la sostituzione e richiedere asset autorizzati.

Alternativa considerata: riprodurre direttamente l'URL di 101soundboards. È stata scartata perché il link è una pagina, non un contratto di streaming stabile, e non risolve il problema dei diritti d'uso.

### Una sorgente per entrambi gli avvisi di turno

Mantenere gli identificatori interni `turn-next` e `turn-now`, così i chiamanti e la deduplicazione degli avvisi non cambiano, e mapparli allo stesso nuovo file. L'ingresso in combattimento usa un file distinto. Il campione di turno misura circa 7,6 LUFS più del campione d'ingresso: ridurre il suo guadagno nella riproduzione, senza modificare il file, affinché il volume percepito sia comparabile. Le preferenze locali, il controllo dell'interazione affidabile e il fallimento silenzioso di `play()` restano nella funzione esistente.

Alternativa considerata: unificare gli identificatori di evento. Non offre beneficio all'utente e amplierebbe la modifica ai chiamanti.

## Risks / Trade-offs

- [Permesso insufficiente o non verificabile] → Non incorporare i campioni finché il titolare non autorizza chiaramente uso e ridistribuzione nell'app.
- [Volume o durata dei nuovi campioni disturbano la sessione] → Controllare durata e livello percepito, mantenere il controllo locale del volume e verificare manualmente i tre avvisi.
- [Asset non caricabile nel browser] → Verificare le due URI audio nel bundle di produzione e il fallimento silenzioso senza perdere l'avviso visivo.
- [Bundle JavaScript più grande] → Limitare l'inclusione ai due MP3 autorizzati e verificare la dimensione del build.

## Migration Plan

Sostituire i file audio precedenti, la loro mappatura e la configurazione Vite in un unico rilascio. Nessuna migrazione di stato o preferenze è necessaria. Un rollback ripristina file, mappatura e configurazione precedenti.
