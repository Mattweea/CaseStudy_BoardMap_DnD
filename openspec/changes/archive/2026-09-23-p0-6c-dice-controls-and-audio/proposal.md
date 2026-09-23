## Why

P0.6b rende il tiro un evento visivo autorevole, ma il partecipante non può ancora interrompere una presentazione lunga, disabilitarla stabilmente o accompagnarla con il feedback sonoro previsto. P0.6c completa l'esperienza locale senza cambiare risultati, visibilità o stato condiviso della sessione.

## What Changes

- Permette di saltare il tiro 3D corrente con `Esc` o con un click durante l'animazione, mostrando subito il risultato già presente nel log e facendo proseguire ordinatamente la coda.
- Introduce preferenze personali persistenti per abilitare o disabilitare separatamente animazione 3D e suoni dei dadi; le scelte riguardano soltanto il browser corrente e non influenzano gli altri partecipanti.
- Abilita i suoni locali della libreria soltanto dopo una reale interazione dell'utente, rispettando le restrizioni di autoplay e degradando silenziosamente se l'audio non è disponibile.
- Estende il processo riproducibile degli asset affinché copi anche i suoni richiesti dalla libreria, senza dipendenze runtime da CDN.
- Mantiene invariati autorità server, log, privacy, ordine delle consegne e fallback numerico introdotti nelle fasi precedenti.
- Esclude temi personalizzati e dadi karmici, che richiedono decisioni e change autonome.

## Capabilities

### New Capabilities

Nessuna.

### Modified Capabilities

- `dice-3d-presentation`: aggiunge controllo di salto, preferenze locali persistenti e audio opzionale subordinato all'interazione utente.

## Impact

La change interessa il controller React dell'overlay 3D, la superficie delle preferenze del client, gli stili e i tipi locali della libreria, oltre allo script di copia degli asset statici e ai relativi test. Non introduce endpoint, eventi SSE, campi nello snapshot, migrazioni o nuove autorizzazioni; nessun risultato di gioco viene affidato al renderer o all'audio.
