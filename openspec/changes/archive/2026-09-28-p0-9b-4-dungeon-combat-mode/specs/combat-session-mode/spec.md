## MODIFIED Requirements

### Requirement: Due modalità di sessione commutate dal Master

La sessione SHALL trovarsi sempre in una di due modalità condivise: **Dungeon** o **Combattimento**. Dungeon SHALL essere la presentazione utente della modalità tecnica Esplorazione/exploration e SHALL essere la modalità predefinita; Combattimento SHALL continuare a usare la modalità tecnica combat. Solo il Master SHALL poter cambiare modalità; il server SHALL rifiutare con errore di autorizzazione la richiesta di un Adventurer. Ogni cambio accettato SHALL incrementare la versione dello stato condiviso ed essere trasmesso a tutti i client connessi. Ogni partecipante SHALL vedere in quale modalità si trova la sessione.

#### Scenario: Il Master entra in Combattimento

- **WHEN** il Master attiva il Combattimento da Dungeon
- **THEN** tutti i client connessi vedono la sessione in modalità Combattimento senza ricaricare la pagina

#### Scenario: Un Adventurer tenta di cambiare modalità

- **WHEN** un Adventurer invia una richiesta di cambio modalità
- **THEN** il server la rifiuta con errore di autorizzazione e la modalità non cambia

#### Scenario: Snapshot precedente senza iniziativa

- **WHEN** viene ripreso uno snapshot salvato prima di questa capability, senza voci d'iniziativa
- **THEN** la sessione si carica in Dungeon, usando lo stato tecnico exploration, senza errori

#### Scenario: Snapshot precedente con un incontro in corso

- **WHEN** viene ripreso uno snapshot salvato prima di questa capability, con voci d'iniziativa e un turno attivo
- **THEN** la sessione si carica in Combattimento a round avviato, con lo stesso ordine, lo stesso turno attivo e lo stesso round
