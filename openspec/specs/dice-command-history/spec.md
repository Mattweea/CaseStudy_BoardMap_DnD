# dice-command-history Specification

## Purpose

Consentire il richiamo privato dei comandi dadi eseguiti tramite tastiera, conservando la bozza e richiedendo un invio esplicito.

## Requirements

### Requirement: Richiamo dei comandi eseguiti

La textbox SHALL conservare fino agli ultimi 50 comandi dadi eseguiti con successo dal partecipante nella sessione locale. Freccia su SHALL richiamare dal più recente al più vecchio; freccia giù SHALL procedere in senso inverso e ripristinare la bozza iniziale oltre il più recente. Ai limiti SHALL NOT esserci wrap. Il richiamo SHALL NOT eseguire il comando né modificare il testo memorizzato. Errori e richieste pendenti SHALL NOT entrare nella cronologia.

#### Scenario: Ordine e bozza

- **WHEN** dopo due comandi accettati il partecipante digita una bozza e usa su, su, giù, giù
- **THEN** vede secondo comando, primo comando, secondo comando e la bozza originale senza nuovi tiri

#### Scenario: Errore e limite

- **WHEN** un comando fallisce oppure sono già stati eseguiti 50 comandi e ne riesce un altro
- **THEN** l’errore non aggiunge voci; il successo conserva le ultime 50 eliminando la più vecchia

#### Scenario: Rilancio

- **WHEN** il partecipante richiama un comando, eventualmente lo modifica, e preme Invio
- **THEN** solo la conferma esplicita esegue un nuovo tiro e un successo aggiunge il comando eseguito

### Requirement: Isolamento e comportamento della textarea

La cronologia SHALL essere privata e locale al partecipante, SHALL azzerarsi al logout o cambio identità e SHALL NOT essere ricostruita dal log condiviso. In testo multilinea, su/giù SHALL conservare il movimento normale del cursore salvo al limite superiore/inferiore del testo; composizione IME, selezioni e combinazioni con modificatori SHALL mantenere il comportamento di editing. Invio e Shift+Invio SHALL conservare il loro significato attuale.

#### Scenario: Identità diversa

- **WHEN** un utente esegue /rs, esce e un altro entra sullo stesso client
- **THEN** il secondo non può richiamare il comando del primo

#### Scenario: Testo multilinea

- **WHEN** il cursore si trova su una riga interna o una composizione IME è attiva
- **THEN** le frecce non sostituiscono il contenuto con una voce della cronologia
