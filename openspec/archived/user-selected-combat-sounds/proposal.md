## Why

I suoni attuali di combattimento sono segnaposto. Il Master ha scelto un effetto preciso per l'ingresso in combattimento e un altro effetto, uguale per entrambi gli avvisi di turno. I tiri per colpire restano esclusi dopo il chiarimento sui due d20 indipendenti.

## What Changes

- Sostituire il suono d'ingresso in combattimento con l'audio indicato dal Master: [29 Gen Combat Start Advantage](https://www.101soundboards.com/sounds/42066404-29-gen-combat-start-advantage).
- Usare lo stesso audio indicato dal Master, [87 UI Town DungeonProgress](https://www.101soundboards.com/sounds/42066405-87-ui-town-dungeonprogress), per «Sei il prossimo!» e «Tocca a te!».
- Mantenere i suoni identici per tutti i partecipanti, lasciando locali soltanto silenziamento e volume.
- Aggiungere gli asset al progetto soltanto dopo aver verificato il permesso di utilizzo e ridistribuzione fornito dal titolare. Se il permesso non copre l'app, la sostituzione resta sospesa e non si incorpora l'audio dai link pubblici.
- Nessun suono per critico o fallimento critico dei tiri per colpire.

## Capabilities

### New Capabilities

Nessuna.

### Modified Capabilities

- `combat-session-mode`: gli avvisi di turno condividono un solo suono scelto dal Master; il suono d'ingresso è quello da lui scelto, con asset ridistribuibili e preferenze locali esistenti.

## Impact

- Asset locali inclusi nel bundle da `src/assets/audio/`, mappatura in `src/utils/combatAudio.ts`, configurazione di Vite e attribuzioni nella tab Impostazioni di `src/App.tsx`.
- Nessuna modifica ad API, stato condiviso, snapshot, SSE, regole dei dadi o autorizzazione.
- Il controllo della licenza è un prerequisito della sostituzione degli asset.
