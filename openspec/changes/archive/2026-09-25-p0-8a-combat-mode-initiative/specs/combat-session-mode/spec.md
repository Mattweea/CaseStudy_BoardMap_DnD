## Purpose

Distinguere l'esplorazione dal combattimento a turni come stato condiviso della sessione, governato dal Master, con un ciclo di vita dell'incontro, un avanzamento dei turni e avvisi sonori coerenti per tutti i partecipanti.

## ADDED Requirements

### Requirement: Due modalità di sessione commutate dal Master

La sessione SHALL trovarsi sempre in una di due modalità condivise: **Esplorazione** o **Combattimento**. La modalità predefinita SHALL essere Esplorazione. Solo il Master SHALL poter cambiare modalità; il server SHALL rifiutare con errore di autorizzazione la richiesta di un Adventurer. Ogni cambio accettato SHALL incrementare la versione dello stato condiviso ed essere trasmesso a tutti i client connessi. Ogni partecipante SHALL vedere in quale modalità si trova la sessione.

#### Scenario: Il Master entra in Combattimento

- **WHEN** il Master attiva il Combattimento da Esplorazione
- **THEN** tutti i client connessi vedono la sessione in modalità Combattimento senza ricaricare la pagina

#### Scenario: Un Adventurer tenta di cambiare modalità

- **WHEN** un Adventurer invia una richiesta di cambio modalità
- **THEN** il server la rifiuta con errore di autorizzazione e la modalità non cambia

#### Scenario: Snapshot precedente senza iniziativa

- **WHEN** viene ripreso uno snapshot salvato prima di questa capability, senza voci d'iniziativa
- **THEN** la sessione si carica in Esplorazione, senza errori

#### Scenario: Snapshot precedente con un incontro in corso

- **WHEN** viene ripreso uno snapshot salvato prima di questa capability, con voci d'iniziativa e un turno attivo
- **THEN** la sessione si carica in Combattimento a round avviato, con lo stesso ordine, lo stesso turno attivo e lo stesso round

### Requirement: Ciclo di vita dell'incontro

Entrando in Combattimento il sistema SHALL svuotare l'ordine di iniziativa, SHALL azzerare turno attivo, movimento usato, alternanza diagonale, scatto e movimento extra, SHALL impostare il round a `1` e SHALL aprire una **fase di tiro**, in cui non esiste un turno attivo e i partecipanti tirano l'iniziativa. Il round 1 SHALL cominciare solo quando il Master lo avvia; da quel momento il turno attivo SHALL essere la prima voce dell'ordine. Il Master SHALL NOT poter avviare il round 1 con un ordine vuoto. Uscendo dal Combattimento il sistema SHALL svuotare l'ordine di iniziativa e azzerare turno attivo, round e contabilità del movimento come all'ingresso.

#### Scenario: Fase di tiro

- **WHEN** il Master entra in Combattimento
- **THEN** l'ordine è vuoto, nessun turno è attivo, il round è `1` e i partecipanti possono tirare l'iniziativa

#### Scenario: Avvio del round 1

- **WHEN** durante la fase di tiro almeno una voce è presente e il Master avvia il round 1
- **THEN** il turno attivo diventa la prima voce dell'ordine e tutti lo vedono evidenziato

#### Scenario: Avvio con ordine vuoto

- **WHEN** il Master prova ad avviare il round 1 senza alcuna voce d'iniziativa
- **THEN** il server rifiuta la richiesta e la sessione resta nella fase di tiro

#### Scenario: Ritorno in Esplorazione

- **WHEN** il Master esce dal Combattimento a round avviato
- **THEN** l'ordine è vuoto, non c'è un turno attivo, il round torna a `1` e il movimento usato di ogni token è azzerato

### Requirement: Avanzamento del turno

Durante il round il Master SHALL poter avanzare al turno successivo, tornare al precedente e scegliere esplicitamente il turno attivo. Superare l'ultima voce SHALL incrementare il round e azzerare la contabilità del movimento di tutti i token; tornare indietro dalla prima voce SHALL decrementare il round senza scendere sotto `1`. Nessun avanzamento SHALL essere possibile in Esplorazione o durante la fase di tiro.

#### Scenario: Fine del round

- **WHEN** il turno attivo è l'ultima voce e il Master avanza
- **THEN** il turno passa alla prima voce, il round aumenta di uno e il movimento usato di ogni token si azzera

#### Scenario: Avanzamento fuori dal round

- **WHEN** la sessione è in Esplorazione o nella fase di tiro e arriva una richiesta di avanzamento
- **THEN** il server la rifiuta e turno e round non cambiano

### Requirement: Fine turno opzionale dell'Adventurer

La sessione SHALL avere un'impostazione condivisa «I giocatori possono terminare il proprio turno», disattivata per impostazione predefinita e modificabile solo dal Master. Quando è attiva, l'Adventurer il cui personaggio è il token attivo SHALL poter terminare il proprio turno con lo stesso effetto dell'avanzamento del Master. Il server SHALL rifiutare la richiesta quando l'impostazione è disattivata, quando il token attivo non appartiene al richiedente o fuori dal round. L'interfaccia SHALL mostrare il comando solo quando la richiesta verrebbe accettata.

#### Scenario: Impostazione disattivata

- **WHEN** l'impostazione è disattivata e l'Adventurer di turno invia una richiesta di fine turno
- **THEN** il server la rifiuta e il turno resta il suo

#### Scenario: Fine del proprio turno

- **WHEN** l'impostazione è attiva e l'Adventurer di turno termina il proprio turno
- **THEN** il turno attivo passa alla voce successiva, esattamente come se avesse avanzato il Master

#### Scenario: Turno altrui

- **WHEN** l'impostazione è attiva e un Adventurer tenta di terminare un turno che non è il suo
- **THEN** il server rifiuta la richiesta e il turno non cambia

### Requirement: Annuncio d'avvio del combattimento

Entrare in Combattimento SHALL mostrare a ogni partecipante connesso, una sola volta per ingresso, un annuncio con l'emblema di due spade incrociate davanti a uno scudo, accompagnato da un effetto sonoro. L'annuncio SHALL chiudersi da solo e SHALL poter essere chiuso prima da mouse o da tastiera. Un aggiornamento di stato che non è un nuovo ingresso in Combattimento SHALL NOT riproporlo. Le icone usate SHALL rispettare il requisito di attribuzione delle risorse grafiche con licenza.

#### Scenario: Annuncio a tutti

- **WHEN** il Master entra in Combattimento con due Adventurer connessi
- **THEN** Master e Adventurer vedono l'annuncio e sentono l'effetto sonoro una volta

#### Scenario: Riconnessione durante il combattimento

- **WHEN** un client che ha già mostrato l'annuncio si riconnette mentre la sessione è ancora in Combattimento
- **THEN** l'annuncio non ricompare

### Requirement: Audio di combattimento locale e controllabile

Gli effetti sonori del combattimento — annuncio d'avvio, «Sei il prossimo!» e «Tocca a te!» — SHALL provenire da asset locali con licenza che ne consente la ridistribuzione. Ogni partecipante SHALL poter silenziare questi suoni e regolarne il volume con preferenze salvate solo nel proprio browser, che SHALL NOT modificare l'esperienza degli altri. Un suono SHALL partire solo dopo un'interazione affidabile con la pagina. Un errore di riproduzione SHALL essere silenzioso e SHALL NOT impedire la comparsa dell'avviso visivo.

#### Scenario: Suoni silenziati

- **WHEN** un partecipante ha silenziato i suoni di combattimento e il Master entra in Combattimento
- **THEN** il partecipante vede l'annuncio senza sentire alcun suono, mentre gli altri lo sentono secondo le proprie preferenze

#### Scenario: Riproduzione impossibile

- **WHEN** il browser rifiuta di riprodurre l'effetto sonoro
- **THEN** l'avviso visivo compare comunque e nessun errore è mostrato
