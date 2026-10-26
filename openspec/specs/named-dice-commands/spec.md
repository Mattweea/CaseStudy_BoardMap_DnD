# named-dice-commands Specification

## Purpose

Consentire un nome facoltativo dei tiri da comando, mantenendo distinti formula, risultato, autore e destinatari autorizzati.

## Requirements

### Requirement: Nome facoltativo del comando

Un partecipante SHALL poter aggiungere una sola opzione finale `-n "nome"` a `/r FORMULA` e `/rs FORMULA`. Il nome SHALL essere testo da 1 a 120 caratteri dopo la rimozione degli spazi esterni; virgolette e backslash nel nome SHALL poter essere rappresentati con escape. Formula e nome SHALL essere separati e il nome SHALL NOT influenzare dadi, modificatori, autore o visibilità. Senza opzione SHALL restare valido il comando esistente.

#### Scenario: Attacco con ascia

- **WHEN** il partecipante invia `/r 1d12+5 -n "attacco con ascia"`
- **THEN** il server tira 1d12+5 e il log mostra attacco con ascia come nome e 1d12+5 come formula

#### Scenario: Tiro segreto e modificatore negativo

- **WHEN** il partecipante invia `/rs 1d12-2 -n "colpo furtivo"`
- **THEN** il nome non altera la sottrazione e il tiro mantiene gli stessi destinatari del normale /rs

#### Scenario: Compatibilità

- **WHEN** il partecipante invia /r 1d20 oppure legge un log precedente privo di nome
- **THEN** il sistema conserva la presentazione e il calcolo precedenti

### Requirement: Validazione senza effetti collaterali

Il sistema SHALL rifiutare con errore leggibile un’opzione ripetuta, virgolette non chiuse, escape non ammessi, nome vuoto, caratteri di controllo, nome oltre il limite o testo residuo dopo il suffisso, senza generare dadi o aggiungere un log. Il server SHALL validare il nome anche quando ricevuto da un client che aggira la textbox. Il nome SHALL essere mostrato come testo e SHALL NOT essere interpretato come HTML.

#### Scenario: Suffisso malformato

- **WHEN** il partecipante invia /r 1d12 -n con virgolette non chiuse o ripete -n
- **THEN** riceve un errore e non viene registrato alcun tiro

#### Scenario: API diretta

- **WHEN** un client invia un nome oltre 120 caratteri direttamente al server
- **THEN** il server rifiuta la richiesta senza log

#### Scenario: Testo simile a markup

- **WHEN** il nome valido contiene una sequenza simile a un tag HTML
- **THEN** la card mostra la sequenza come testo senza eseguire markup
