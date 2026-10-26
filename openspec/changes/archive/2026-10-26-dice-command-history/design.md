## Context
DicePanel contiene la textarea /r e /rs; Enter invia e Shift+Enter inserisce una nuova riga. Il successo di onRoll svuota il campo.
## Goals / Non-Goals
Richiamo dei propri comandi; nessuna ricostruzione dal log condiviso, che potrebbe esporre tiri segreti altrui.
## Decisions
Conservare fino a 50 comandi accettati, in memoria e per utente/sessione autenticata. Nessuna persistenza dopo logout o reload richiesta. Conservare il testo integrale incluso -n quando disponibile e distinguere duplicati realmente eseguiti. Freccia su all'inizio della prima riga richiama il precedente; giù alla fine dell'ultima riga richiama il successivo, poi la bozza originale. Nessun wrap ai limiti. Nessuna intercettazione con modificatori, selezione attiva o composizione IME; rispettare movimento del cursore nelle altre righe. Modificare un comando richiamato lo trasforma in bozza e azzera il cursore di cronologia.
## Risks
Un errore o una richiesta in corso non deve aggiungere voci. Un cambio identità deve azzerare cronologia/bozza. Non usare lo storico come dati condivisi né inviarlo al server.
## Verification
Test di macchina a stati e verifica tastiera nel textarea reale, inclusi multilinea, IME, comandi segreti e bozza.
