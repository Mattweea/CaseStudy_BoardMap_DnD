## Why

La barra PF sempre aperta sotto ogni token che il Master può vedere copre i personaggi vicini. Serve conservare l'indicazione proporzionale dei PF senza occupare quello spazio finché il token non è consultato.

## What Changes

- La barra PF di ogni token autorizzato è normalmente una riga sottile sotto l'icona, con il riempimento proporzionale invariato.
- Al passaggio del mouse o al focus da tastiera, la barra si espande e mostra i numeri degli HP attuali, massimi e temporanei come oggi.
- Calcolo, soglie di colore, dati consegnati e permessi restano invariati.

La modifica viene integrata nel branch `feat/p0-9-maps-and-scenes`.

## Capabilities

### Added Capabilities

- `hit-points`: modifica la presentazione della barra sul token, mantenendo la riservatezza e il nome accessibile.

## Impact

Markup e CSS del token e contratto frontend della board. Regressioni principali: leggibilità di PF temporanei, zero PF, focus da tastiera e assenza della barra sui token senza massimo valido.
