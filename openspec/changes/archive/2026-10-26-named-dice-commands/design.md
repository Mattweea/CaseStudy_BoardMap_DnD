## Context
DicePanel invia oggi tutto il testo dopo /r o /rs come formula. Il server resta responsabile della validazione, dei risultati e dei destinatari.
## Goals / Non-Goals
Nome descrittivo facoltativo, senza trasformarlo in formula, azione della scheda o codice eseguibile.
## Decisions
Suffisso unico a fine comando: /r FORMULA -n "NOME" (anche /rs). Tokenizzare rispettando le virgolette; non usare split generico sui trattini che romperebbe i modificatori negativi. Supportare escape di virgolette e backslash. Trim del nome, 1–120 caratteri Unicode dopo trim; rifiutare nome vuoto, escape non valido, controlli, virgolette non chiuse, opzione ripetuta o testo dopo il suffisso. Server valida anche il campo nome delle richieste dirette. Nome trattato come testo, mai HTML. Senza nome il comportamento precedente resta identico; non aggiungere didascalie che ripetano la formula. Preservare formula e autore, senza usare il nome come source/action o identità.
## Compatibility
Vecchi log senza nome restano leggibili. Nessun nuovo accesso ai segreti; nome e formula viaggiano con le stesse regole public/secret. Per la card aggiornare il requisito canonico Log distinguibile tramite il delta MODIFIED allegato, mantenendo tutti gli scenari precedenti.
## Verification
Parser e endpoint: esempio esatto, /rs, formula mista, sottrazioni, Unicode, escaping, malformed, HTML mostrato come testo, assenza nome e storico legacy. E2E UI: nome visibile e formula/totali invariati.
