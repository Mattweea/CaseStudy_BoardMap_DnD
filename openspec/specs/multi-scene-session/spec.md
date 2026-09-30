# Multi-Scene Session Specification

## Purpose

Definire il comportamento autorevole, realtime e coerente delle sessioni che attraversano più scene, incluse attivazione, isolamento e transizioni condivise.

## Requirements

### Requirement: P0.9d.1 Transizione realtime della scena attiva
Il sistema SHALL consentire soltanto al Master di attivare una scena e SHALL distribuire atomicamente la nuova proiezione a tutti i client connessi. Il server SHALL rifiutare il cambio mentre un round di combattimento è attivo.

#### Scenario: Cambio in Dungeon
- **WHEN** il Master attiva una scena in Dungeon e nessun round è attivo
- **THEN** tutti i client ricevono la nuova identità e proiezione senza ricaricare

#### Scenario: Cambio in roll phase
- **WHEN** il Master cambia scena in Combattimento prima dell'avvio del round
- **THEN** il server attiva la scena e azzera tracker e riferimenti incompatibili prima del broadcast

#### Scenario: Round attivo
- **WHEN** il Master tenta il cambio mentre un round è attivo
- **THEN** il server rifiuta e tutti i client restano sulla scena corrente

#### Scenario: Adventurer
- **WHEN** un Adventurer tenta di attivare una scena
- **THEN** il server rifiuta per autorizzazione

### Requirement: P0.9d.2 Isolamento dei Player sulla scena attiva
Il sistema SHALL accettare dai Player soltanto operazioni riferite alla scena attiva e SHALL omettere dalle loro viste catalogo, documenti e asset delle scene inattive, applicando la sanitizzazione già prevista dall'architettura corrente.

#### Scenario: Mutazione inattiva
- **WHEN** un Player invia una mutazione per una scena non attiva o una versione precedente
- **THEN** il server la rifiuta senza modificare alcuna scena

#### Scenario: Cambio con interazione in corso
- **WHEN** il client riceve un activeSceneId differente
- **THEN** azzera camera, selezione, percorso, righello, sagoma, ping e code effimere precedenti

#### Scenario: Contenuti inattivi
- **WHEN** il server produce una vista Player
- **THEN** catalogo, documenti e asset delle scene inattive sono omessi

#### Scenario: Confine P0.10
- **WHEN** il Player riceve la proiezione sanitizzata della scena attiva
- **THEN** P0.9d.2 non garantisce il filtraggio completo di ogni segreto o dato oltre il fog
