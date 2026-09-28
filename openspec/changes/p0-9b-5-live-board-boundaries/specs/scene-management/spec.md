# Spec Delta

## ADDED Requirements

### Requirement: Dimensioni finite o illimitate della scena
La configurazione dimensionale della scena SHALL accettare una coppia di interi positivi entro i limiti consentiti oppure la coppia `0 × 0` per la modalità illimitata. Una coppia mista con un solo zero, valori negativi, non interi o fuori limite SHALL essere rifiutata senza mutare documento, versione o stato condiviso. Solo il Master autenticato SHALL poter salvare la configurazione, con la stessa protezione dai conflitti di versione delle altre modifiche della scena. Le scene legacy con dimensioni positive SHALL conservare tali valori.

#### Scenario: Salvataggio della modalità illimitata
- **WHEN** il Master salva `0 × 0` con una versione corrente
- **THEN** il server persiste entrambe le dimensioni a zero, incrementa la versione e distribuisce la configurazione ai client autorizzati

#### Scenario: Coppia mista non valida
- **WHEN** viene inviata una configurazione con zero colonne e un numero positivo di righe
- **THEN** il server rifiuta la richiesta senza cambiare scena o versione

#### Scenario: Accesso e concorrenza
- **WHEN** un Player o un Master con versione obsoleta tenta di modificare le dimensioni
- **THEN** il server rifiuta la mutazione e conserva la configurazione confermata

#### Scenario: Compatibilità
- **WHEN** viene caricata una scena precedente con dimensioni positive valide
- **THEN** il sistema conserva la board finita senza richiedere migrazione manuale
