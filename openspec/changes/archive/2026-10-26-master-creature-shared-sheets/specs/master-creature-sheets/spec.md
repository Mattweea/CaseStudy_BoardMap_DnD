## ADDED Requirements

### Requirement: Creazione di schede per creature del Master

Il Master SHALL poter creare, aprire e modificare più schede di creatura: per PG/PNG la scheda personaggio esistente e per mostri un blocco statistiche dedicato ispirato al Manuale dei Mostri 5e 2014 per PG/nemici di propria creazione nella campagna, senza creare account di login e senza alterare la scheda unica degli Adventurer.

#### Scenario: Nuova scheda

- **WHEN** il Master apre una creatura creata manualmente e sceglie di crearne la scheda
- **THEN** ritrova la scheda appropriata al tipo: scheda personaggio per PG/PNG oppure blocco statistiche per mostri, e conserva i valori dopo il salvataggio e la riapertura

#### Scenario: Più schede

- **WHEN** il Master crea schede per due tipi diversi di nemico
- **THEN** le schede restano distinte e le schede personali Adventurer restano invariate

### Requirement: Collegamento condiviso con stato individuale

Il Master SHALL poter assegnare esplicitamente la stessa scheda a una o più creature, anche a un lotto in creazione. Una modifica dei dati comuni SHALL essere propagata soltanto ai destinatari confermati dal Master al salvataggio. Nome individuale, HP correnti e temporanei, condizioni, posizione, iniziativa tirata e risorse consumate SHALL restare indipendenti. Avere nomi uguali SHALL NOT collegare automaticamente creature.

#### Scenario: Quattro diavoli

- **WHEN** il Master assegna una scheda ai quattro Diavoli spinati
- **THEN** i quattro usano gli stessi dati comuni e conservano nomi numerati distinti

#### Scenario: Ferita individuale

- **WHEN** un diavolo collegato riceve danno o una condizione
- **THEN** gli HP e le condizioni degli altri tre non cambiano

#### Scenario: Modifica comune

- **WHEN** il Master aggiorna un attacco o la CA della scheda condivisa e conferma Applica a tutte
- **THEN** tutti i token collegati usano la nuova definizione senza perdere il proprio stato individuale

#### Scenario: Variazione degli HP massimi

- **WHEN** il Master abbassa gli HP massimi comuni sotto gli HP correnti di un token
- **THEN** il token conserva i propri HP correnti e la discrepanza è visibile al Master, senza cura o danno implicito

### Requirement: Autorizzazione e sincronizzazione riservata

Solo il Master SHALL poter leggere e modificare queste schede e i loro collegamenti. Patch valide SHALL essere versionate e sincronizzate alle finestre Master autorizzate; conflitti sullo stesso campo SHALL essere rifiutati senza sovrascrittura silenziosa. Gli Adventurer SHALL NOT ricevere documenti o note private tramite HTTP, SSE o snapshot della mappa.

#### Scenario: Richiesta di un Adventurer

- **WHEN** un Adventurer richiede direttamente una scheda nemica o prova a cambiare un collegamento
- **THEN** l’operazione è negata senza esporre il contenuto privato

#### Scenario: Conflitto

- **WHEN** due finestre Master cambiano lo stesso campo da una versione obsoleta
- **THEN** la seconda modifica è rifiutata con stato corrente e possibilità di risoluzione

### Requirement: Durabilità e ciclo di vita dei collegamenti

Schede e collegamenti SHALL sopravvivere alle rispettive procedure di salvataggio e ripristino. Snapshot precedenti senza collegamenti SHALL continuare a caricarsi. Un riferimento a una scheda mancante SHALL produrre una segnalazione al Master senza impedire il caricamento della mappa. Eliminare un token SHALL NOT eliminare la scheda; cancellare una scheda ancora collegata SHALL essere rifiutato. Scollegare SHALL conservare lo stato corrente della creatura.

#### Scenario: Ripristino

- **WHEN** si riavvia dopo flush della scheda e si ripristina uno snapshot salvato con quattro collegamenti
- **THEN** le quattro creature ritrovano la stessa definizione e il proprio stato

#### Scenario: Snapshot legacy o riferimento mancante

- **WHEN** si carica uno snapshot senza sheet ID oppure con un ID non disponibile
- **THEN** il primo resta valido; il secondo carica la mappa segnalando il collegamento non risolto al Master

#### Scenario: Rimozione

- **WHEN** il Master elimina uno dei quattro token e tenta poi di cancellare la scheda ancora collegata agli altri
- **THEN** la definizione sopravvive alla rimozione del token e la cancellazione viene rifiutata finché restano collegamenti



### Requirement: Popup di salvataggio con destinatari espliciti
Salvando una scheda condivisa da più creature, il sistema SHALL mostrare prima di ogni scrittura un popup con l'elenco delle schede/creature interessate, distinguendo omonimi tramite scena e riferimento. Il Master SHALL poter scegliere Applica a tutte, Solo questa oppure Annulla. Il popup SHALL distinguere i dati comuni dalle modifiche individuali che non si propagano.

#### Scenario: Applicazione a tutte
- **WHEN** il Master salva un attacco modificato sulla scheda condivisa da quattro diavoli
- **THEN** il popup elenca i quattro destinatari e soltanto dopo la conferma Applica a tutte l'attacco cambia su tutte e quattro le schede

#### Scenario: Applicazione alla sola creatura aperta
- **WHEN** il Master sceglie Solo questa nel popup
- **THEN** soltanto la creatura aperta conserva i nuovi dati tramite una scheda indipendente e le altre tre restano invariate

#### Scenario: Annullamento e nessuna autoscrittura
- **WHEN** il Master modifica la bozza e poi annulla il popup o lo chiude con Escape
- **THEN** nessun destinatario viene modificato, la bozza resta disponibile e nessun autosalvataggio ha anticipato la scelta

#### Scenario: Destinatari concorrenti
- **WHEN** cambia il gruppo di schede collegate o un campo coinvolto dopo l'apertura del popup
- **THEN** il salvataggio viene rifiutato senza aggiornamenti parziali e l'elenco aggiornato richiede una nuova conferma

### Requirement: Azioni e risorse per creatura
Il Master SHALL poter usare le azioni di tiro offerte dalla scheda del tipo di creatura, con validazione e calcolo autorevole esistenti. Ogni azione SHALL riferirsi alla creatura aperta; il consumo di risorse e le variazioni dello stato individuale SHALL NOT modificare le altre creature che condividono la definizione.

#### Scenario: Risorsa di una creatura
- **WHEN** il Master usa un'azione che consuma una risorsa sulla scheda del primo diavolo
- **THEN** viene consumata solo la risorsa del primo e gli altri tre mantengono la propria disponibilità

#### Scenario: Parità della scheda
- **WHEN** il Master confronta una nuova scheda PG/PNG con una scheda personaggio esistente
- **THEN** dispone delle stesse tre tab, campi, sezioni, editor e interazioni di tiro, nel contesto della creatura aperta

### Requirement: Blocco statistiche dedicato ai mostri
Una creatura di tipo mostro SHALL usare una scheda distinta dalla scheda PG, ispirata al blocco statistiche del Manuale dei Mostri 5e 2014. SHALL consentire compilazione manuale di identità, taglia/tipo/allineamento, CA, PF e dadi vita, velocità, caratteristiche, TS/abilità, vulnerabilità/resistenze/immunità, sensi, lingue, GS/PE, tratti e azioni. Il Master SHALL poter definire anche azioni bonus, reazioni e azioni leggendarie.

#### Scenario: Apertura della scheda di un mostro
- **WHEN** il Master crea la scheda di un Diavolo spinato monster
- **THEN** trova il blocco statistiche del mostro invece delle tre tab della scheda PG, può compilare i campi e ritrovarli dopo il salvataggio

#### Scenario: Tipo e dati incompatibili
- **WHEN** un client tenta di salvare dati di scheda PG come documento mostro o il contrario
- **THEN** il server rifiuta i dati incompatibili senza cambiare la scheda

#### Scenario: Mostri con scheda condivisa
- **WHEN** il Master modifica un tratto nella scheda condivisa da quattro mostri e preme Salva
- **THEN** compare lo stesso popup con l'elenco dei quattro destinatari e la scelta di applicare a tutti, solo a quello aperto oppure annullare
