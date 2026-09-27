## Purpose

Facilitare la sostituzione dei valori nei campi testuali durante la partita e la modifica della scheda.

## Requirements

### Requirement: Selezione del contenuto al focus

Quando un campo testuale modificabile riceve il focus, l'app SHALL selezionarne tutto il contenuto. La regola SHALL valere per gli input `text`, `search`, `email`, `password`, `tel` e `url`, compresi quelli senza attributo `type`, e per le aree di testo. SHALL valere sia col puntatore sia con la tastiera e per i controlli montati dopo l'avvio dell'app. Non SHALL modificare la selezione di campi `readOnly` o disabilitati, né i controlli non testuali come `number`, checkbox, radio, file e select. Dopo il focus, l'utente SHALL poter spostare il cursore o scegliere una selezione parziale senza che il testo venga riselezionato finché il focus resta nello stesso campo.

#### Scenario: HP della scheda

- **WHEN** il proprietario porta il focus sul campo «Attuali» che contiene `12`
- **THEN** `12` è selezionato e scrivere `7` lo sostituisce

#### Scenario: Campo creato dopo l'avvio

- **WHEN** il Master apre il campo HP del menu radiale e questo riceve il focus
- **THEN** l'intero contenuto del campo è selezionato

#### Scenario: Ricerca e area di testo

- **WHEN** un utente porta il focus su una ricerca compilata o su un'area di testo con una nota
- **THEN** tutto il testo del controllo è selezionato

#### Scenario: Controlli esclusi

- **WHEN** un utente porta il focus su un input numerico, una checkbox o un campo di testo non modificabile
- **THEN** il nuovo comportamento non ne modifica la selezione o lo stato

#### Scenario: Riposizionamento del cursore

- **WHEN** un campo testuale è già a fuoco e l'utente fa click su una posizione del suo testo
- **THEN** il cursore può essere posizionato lì senza selezionare di nuovo tutto il contenuto

#### Scenario: Prefisso HP dal menu

- **WHEN** un utente apre il campo HP del menu premendo `-` e digita `3`
- **THEN** il campo contiene `-3`, che viene applicato come danno alla conferma
