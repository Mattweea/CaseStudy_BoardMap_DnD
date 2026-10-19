## Purpose

Consente al Master di preparare disegni persistenti sulle scene prima o durante il gioco, mantenendo privata la preparazione delle scene non attive.

## ADDED Requirements

### Requirement: P0.9c.1 Disegno separato da elementi e token
Il sistema SHALL consentire al Master di aggiungere tratti con la matita e rimuoverli con la gomma soltanto nel dialog Preparazione scena, conservando i disegni in un layer persistente distinto dagli elementi scenici e dai token. La board di gioco SHALL mostrare i tratti confermati senza strumenti di modifica drawing.

#### Scenario: Tratto confermato
- **WHEN** il Master conclude un gesto valido nella preview della scena selezionata
- **THEN** il client invia una sola operazione versionata e il tratto viene salvato in quella scena

#### Scenario: Scena inattiva preparata
- **WHEN** il Master disegna su una scena inattiva
- **THEN** il tratto rimane disponibile nel suo editor ma non appare sulla board di gioco né negli snapshot dei Player

#### Scenario: Scena attiva modificata
- **WHEN** il Master disegna sulla scena attiva dal dialog
- **THEN** il tratto confermato appare subito sulla board di Master e Player

#### Scenario: Regolazione della matita
- **WHEN** il Master regola lo spessore o sceglie un colore prima di disegnare
- **THEN** vede una preview della dimensione e del colore del pennello senza creare o modificare tratti confermati

#### Scenario: Gomma selettiva
- **WHEN** il Master usa la gomma su uno o più tratti
- **THEN** un indicatore sotto il cursore mostra l'area effettiva della gomma e vengono rimossi soltanto i tratti identificati, non elementi o token sovrapposti

#### Scenario: Player
- **WHEN** un Player visualizza la scena
- **THEN** vede i disegni confermati della sola scena attiva ma non può aprire gli strumenti drawing né inviare operazioni drawing
