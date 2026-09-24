# authoritative-dice-engine Specification

## Purpose

Definire un unico motore verificabile che produca dadi equi, risultati aggregati coerenti e un contratto per-dado consumabile senza affidare al client alcuna decisione sull'esito.

## Requirements

### Requirement: Campionamento uniforme esatto

Il motore SHALL generare ogni dado supportato come variabile uniforme discreta su `{1, …, S}`, usando entropia crittografica in esecuzione reale e scartando i valori della sorgente che introdurrebbero modulo bias. Ogni dado di un tiro composto SHALL essere generato indipendentemente dagli altri.

#### Scenario: Valore nel dominio del dado

- **WHEN** il motore genera un d4, d6, d8, d10, d12, d20 o d100
- **THEN** restituisce un intero compreso fra 1 e il numero di facce e ogni faccia ha probabilità esattamente `1/S`

#### Scenario: Valore oltre il limite uniforme

- **WHEN** la sorgente produce un intero a 32 bit appartenente alla coda che non può essere ripartita equamente fra le facce
- **THEN** il motore scarta quel valore e richiede nuova entropia prima di produrre il dado

### Requirement: Unica porta di ingresso e risultato per-dado

Ogni tiro autorevole SHALL passare dalla stessa porta di ingresso del motore. Il risultato SHALL includere totale e modificatore, i campi aggregati compatibili e una voce per ogni dado fisicamente generato con `id` univoco nel tiro, `sides`, `value`, `groupId` e `disposition`. Un d100 SHALL essere rappresentato come un singolo dado logico con `sides: 100` e valore da 1 a 100.

#### Scenario: Formula con più dadi

- **WHEN** il motore risolve `2d6+1`
- **THEN** restituisce due voci per-dado distinte nello stesso gruppo, entrambe `kept`, e un totale pari alla loro somma più uno

#### Scenario: Dado percentile logico

- **WHEN** il motore genera un d100 con risultato 100
- **THEN** il contratto contiene una sola voce con `sides: 100` e `value: 100`, senza imporre al dominio la rappresentazione grafica a due dadi percentile

### Requirement: Disposizione esplicita dei dadi

Il motore SHALL marcare ogni dado come `kept`, `discarded` oppure `unresolved`. Un tiro normale SHALL marcare come `kept` tutti i dadi che partecipano al totale; vantaggio e svantaggio SHALL generare due d20, marcarne esattamente uno come `kept` e l'altro come `discarded`, e calcolare il totale dal dado tenuto. Quando il dominio rinvia la scelta al lettore, il motore SHALL marcare i dadi coinvolti come `unresolved` e SHALL NOT dedurre una selezione.

#### Scenario: Vantaggio con risultati diversi

- **WHEN** un tiro con vantaggio produce 7 e 16
- **THEN** il d20 con valore 16 è `kept`, quello con valore 7 è `discarded` e il totale usa 16

#### Scenario: Svantaggio in parità

- **WHEN** un tiro con svantaggio produce due risultati uguali
- **THEN** il primo d20 generato è `kept`, il secondo è `discarded` e il totale resta invariato

#### Scenario: Coppia non risolta dal server

- **WHEN** il dominio richiede due d20 indipendenti senza scegliere quale contare
- **THEN** entrambi sono `unresolved` e nessuno è marcato `kept` o `discarded`

### Requirement: Modelli probabilistici e verifica riproducibile

Il motore SHALL descrivere e rendere verificabili i modelli di probabilità per `1dS`, `NdS`, vantaggio, svantaggio, successo contro CD e soglia di critico. SHALL consentire di sostituire la sorgente di interi esclusivamente attraverso un punto di iniezione interno per test deterministici; l'esecuzione reale SHALL usare soltanto la sorgente crittografica e SHALL NOT accettare né esporre seed attraverso API, stato condiviso o log.

#### Scenario: Suite statistica ripetibile

- **WHEN** la suite esegue un campione dichiarato usando la sorgente deterministica di test
- **THEN** verifica copertura delle facce, media, varianza, uniformità chi-quadro e distribuzioni di vantaggio e svantaggio con soglie dichiarate, ottenendo lo stesso esito a ogni esecuzione

#### Scenario: Esecuzione reale

- **WHEN** un partecipante richiede un tiro in una sessione reale
- **THEN** nessun seed controllabile o ricostruibile dal client influenza il risultato o compare nei dati consegnati
