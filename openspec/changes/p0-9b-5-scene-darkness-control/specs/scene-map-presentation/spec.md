# Spec Delta

## ADDED Requirements

### Requirement: P0.9b.5 Controllo del buio per scena
Il sistema SHALL consentire soltanto al Master di configurare nel dialog di preparazione se il buio è attivo per la scena selezionata. Il valore SHALL appartenere al documento versionato della singola scena; quando la scena è attiva, la configurazione confermata SHALL essere proiettata a tutti i client, mentre una scena inattiva SHALL conservarla senza influenzare la board corrente.

#### Scenario: Preparazione di una scena inattiva
- **WHEN** il Master modifica il buio di una scena inattiva e salva la bozza
- **THEN** il server persiste la nuova versione senza cambiare l'illuminazione della scena attiva

#### Scenario: Attivazione successiva
- **WHEN** il Master attiva una scena preparata con il buio disattivato
- **THEN** Master e Player vedono la board completamente illuminata senza ulteriori azioni

#### Scenario: Modifica della scena attiva
- **WHEN** il Master cambia e salva il buio della scena attiva
- **THEN** tutti i client connessi ricevono la nuova proiezione senza ricaricare

#### Scenario: Annullamento della bozza
- **WHEN** il Master cambia il controllo ma annulla o chiude senza salvare
- **THEN** il documento scena e l'illuminazione condivisa restano invariati

#### Scenario: Autorizzazione
- **WHEN** un utente non Master tenta di modificare il buio di una scena
- **THEN** il server rifiuta la richiesta senza cambiare il documento o la proiezione

#### Scenario: Conflitto di versione
- **WHEN** il Master salva il buio usando una versione base obsoleta
- **THEN** il server rifiuta la mutazione e restituisce la scena corrente per la riconciliazione

#### Scenario: Compatibilità legacy
- **WHEN** il sistema carica una scena priva della configurazione del buio
- **THEN** la normalizza con il buio attivo senza richiedere una migrazione manuale

#### Scenario: Confine della capability
- **WHEN** il Master configura il buio della scena
- **THEN** P0.9b.5 riusa illuminazione e visione esistenti senza introdurre fog server-side o nuove sorgenti luminose
