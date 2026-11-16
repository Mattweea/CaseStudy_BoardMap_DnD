## MODIFIED Requirements

### Requirement: Avviso di presenza in un'aura

Un Adventurer con un proprio token dentro l'aura accesa di un altro personaggio SHALL vedere un controllo compatto Aure con il numero delle presenze applicabili in alto a destra della mappa, anche a schermo intero. L'elenco SHALL essere inizialmente chiuso ed espandibile con mouse, touch o tastiera. Il controllo SHALL rimanere visibile mentre esiste almeno una presenza; l'arrivo di nuove aure SHALL aggiornare il contatore senza aprire automaticamente l'elenco.

Aprendo l'elenco, il pannello SHALL mostrare una riga per ogni presenza: «Sei nell'aura di <personaggio>: <nome>» per il token canonico, «<famiglio> è nell'aura di <personaggio>: <nome>» per un famiglio. La forma SHALL restare grammaticalmente corretta qualunque sia il nome dell'aura. Ogni riga SHALL poter essere espansa, con il mouse o con la tastiera, per leggere l'effetto dell'aura. Il pannello SHALL restare entro lo spazio della mappa e scorrere internamente quando necessario. Il pulsante SHALL dichiarare lo stato di espansione; un secondo azionamento o Escape dal pannello SHALL richiuderlo, mantenendo disponibili le informazioni dal controllo compatto.

La presenza SHALL aggiornarsi senza ricaricare la pagina quando un token entra o esce, quando un'aura si accende o si spegne o quando ne cambia il raggio. Un'aura del proprio personaggio SHALL NOT produrre avvisi per i token dello stesso proprietario. Il Master SHALL NOT ricevere avvisi. L'ingresso in una nuova aura SHALL essere annunciato alle tecnologie assistive senza spostare il fuoco, anche quando il pannello è chiuso. Uscendo da tutte le aure, il controllo SHALL sparire; un successivo ingresso SHALL ripartire con l'elenco chiuso.

#### Scenario: Ingresso nell'aura di un alleato

- **WHEN** un Adventurer muove il proprio token nell'area accesa «Aura di protezione» di Ilthar
- **THEN** compare il controllo compatto in alto a destra con il contatore aggiornato e l'elenco chiuso
- **AND** aprendo il controllo legge «Sei nell'aura di Ilthar: Aura di protezione»

#### Scenario: Lettura dell'effetto

- **WHEN** l'Adventurer apre il pannello ed espande una riga con la tastiera
- **THEN** il pannello mostra l'effetto dell'aura

#### Scenario: Uscita dall'aura

- **WHEN** l'Adventurer muove il proprio token fuori da tutte le aree
- **THEN** il controllo sparisce e un successivo ingresso mostra l'elenco chiuso

#### Scenario: Aura spenta

- **WHEN** il proprietario spegne l'ultima aura applicabile mentre l'Adventurer è dentro l'area
- **THEN** il controllo sparisce per l'Adventurer

#### Scenario: Due aure insieme

- **WHEN** il token di un Adventurer è dentro due aure accese di personaggi diversi
- **THEN** il controllo mostra due presenze e l'elenco espanso mostra due righe

#### Scenario: Famiglio nell'aura

- **WHEN** il famiglio di un Adventurer entra nell'area accesa di un altro personaggio
- **THEN** il contatore si aggiorna e l'elenco espanso contiene una riga che nomina il famiglio

#### Scenario: Aura propria

- **WHEN** un Adventurer accende una propria aura con il proprio token e il proprio famiglio dentro l'area
- **THEN** l'Adventurer non riceve alcun avviso per quell'aura

#### Scenario: Master

- **WHEN** un token nemico si trova dentro l'aura accesa di un personaggio
- **THEN** il Master vede l'area sulla mappa e non riceve alcun avviso

#### Scenario: Nuova aura a pannello chiuso

- **WHEN** una nuova aura diventa applicabile mentre il pannello è chiuso
- **THEN** il contatore e l'annuncio accessibile si aggiornano senza espandere il pannello né spostare il focus

#### Scenario: Richiusura e schermo intero

- **WHEN** l'Adventurer preme Escape da una riga dell'elenco nella mappa normale o fullscreen
- **THEN** l'elenco si chiude e il focus torna al controllo compatto dell'host attivo

#### Scenario: Molte aure su uno schermo stretto

- **WHEN** l'Adventurer apre numerose aure con effetti lunghi su uno schermo stretto
- **THEN** il pannello rimane entro la mappa e permette di leggere tutte le righe tramite scroll interno
