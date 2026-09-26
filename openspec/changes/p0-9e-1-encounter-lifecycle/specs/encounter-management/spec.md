## ADDED Requirements

### Requirement: P0.9e.1 Lifecycle degli encounter associati alla scena
Il sistema SHALL consentire al Master di creare, elencare, leggere, modificare e rimuovere encounter associati a una scena mediante mutazioni autorizzate e versionate. Un encounter SHALL poter rappresentare combattimento, narrazione o altra situazione supportata senza avviare automaticamente il combattimento.

#### Scenario: Encounter narrativo
- **WHEN** il Master crea un encounter narrativo valido
- **THEN** compare nella scena senza cambiare sessionMode o iniziativa

#### Scenario: Modifica concorrente
- **WHEN** due modifiche usano la stessa versione base
- **THEN** la seconda è rifiutata senza sovrascrivere la prima

#### Scenario: Rimozione referenziata
- **WHEN** il Master tenta di rimuovere un encounter con placement collegati
- **THEN** il server rifiuta finché i placement non sono rimossi esplicitamente

#### Scenario: Player
- **WHEN** un Player invia una mutazione encounter
- **THEN** il server la rifiuta per autorizzazione
