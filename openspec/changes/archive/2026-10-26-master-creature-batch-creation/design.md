## Context
Riferimento legacy: origin/main a 2dc889d7cd1f100c83cd0d594b3d2ee7a366f213, ElementModals.tsx. Quantità 1 mantiene il nome; un lotto N usa base + spazio + indice da 1 a N. Un nuovo lotto ricomincia da 1: non esiste unicità globale del nome.
## Goals / Non-Goals
Rendere affidabile e raggiungibile la creazione multipla; non introdurre copie dei PG canonici né account di login.
## Decisions
Prima riprodurre il flusso attuale e riusare quantità/createToken/addTokens. Proposta di limite operativo: 1–100 creature per invio, da validare anche sul server. Rifiutare interi fuori intervallo, vuoti e frazioni nella UI, senza coercizioni sorprendenti. ID distinti, posizioni valide e commit atomico: un errore non lascia un lotto parziale. Conservare impostazioni di visibilità e proprietà scelte dal master. Oggetti, ostacoli e veicoli mantengono il flusso esistente.
## Risks
Il commit totale della mappa può essere obsoleto: trattare 409 come conflitto senza duplicare il lotto al retry. Per il limite non basta contare tutti i token della mappa: validare gli elementi nuovi dell'operazione.
## Verification
Test su nomi 1/4, lotti ripetuti, ID, collisioni, quantità invalide, autorizzazione, stale write, SSE e undo.

## Integrazione con la base test
Il flusso moderno è SceneEncounterEntitySection + SceneEncounterPlacementSection: la singola definizione monster/npc è distinta dai placement. Inserire Quantità nel flusso di creazione/collocazione moderno, non limitarsi alla modale legacy già funzionante. Una definizione può generare N placement con ID e nomi individuali: non duplicare automaticamente N definizioni. La creazione della sola definizione non colloca nulla; il Master conferma esplicitamente preview e posizioni del lotto. Le scene inattive ricevono solo preparazione; la scena attiva proietta il lotto nel runtime con un unico aggiornamento. Validare versione della scena e runtime, dimensioni finite/illimitate, collisioni e persistenza prima del commit. La nomina legacy si applica alle istanze, non rinomina la definizione. Per placement persistiti, rimozione/undo deve usare la mutazione versionata della scena e non soltanto lo snapshot undo live.
