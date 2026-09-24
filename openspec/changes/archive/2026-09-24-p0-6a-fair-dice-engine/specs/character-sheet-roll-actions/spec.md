## ADDED Requirements

### Requirement: Tiri della scheda equi con disposizione coerente col dominio

Ogni dado generato da un'azione della scheda SHALL passare dallo stesso motore autorevole equo dei tiri liberi e SHALL comparire nel dettaglio per-dado della voce di log. I dadi che contribuiscono senza ambiguità al risultato SHALL essere `kept`; i due d20 indipendenti di un bersaglio `1d20` per cui la scelta resta alla persona SHALL essere entrambi `unresolved`. Dadi appartenenti a blocchi di danno diversi SHALL avere gruppi distinti. I campi aggregati e le parti esistenti SHALL restare disponibili e coerenti con il dettaglio per-dado.

#### Scenario: Bersaglio 1d20 con scelta rinviata

- **WHEN** un utente autorizzato tira una prova di abilità dalla scheda
- **THEN** il log contiene due d20 distinti entrambi `unresolved`, mentre `rolls`, `keptRolls` e `total` mantengono la compatibilità già definita per il primo tiro

#### Scenario: Danno con due blocchi

- **WHEN** un utente autorizzato tira un attacco con due blocchi di danno attivi
- **THEN** tutti i dadi sono `kept`, i dadi di ciascun blocco condividono il proprio `groupId` e i due blocchi hanno `groupId` diversi

#### Scenario: Dadi raddoppiati dal critico

- **WHEN** il server applica il critico a un tiro di danno
- **THEN** il dettaglio contiene anche ciascun dado aggiuntivo generato dal raddoppio e totale, parti e campi aggregati restano coerenti

#### Scenario: Effetto collaterale del tiro

- **WHEN** un dado vita o un salvataggio contro morte viene accettato
- **THEN** il valore usato per l'effetto collaterale proviene dal medesimo risultato per-dado autorevole registrato nel log
