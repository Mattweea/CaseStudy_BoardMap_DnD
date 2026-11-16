# Spec Delta

## MODIFIED Requirements

### Requirement: Percorso di preparazione navigabile

Il sistema SHALL offrire soltanto al Master un percorso composto, nell'ordine, da Base, Pareti e ambiente, Luci e visuale, Encounter, Mostri e PNG e Riepilogo. Durante l'editing SHALL mantenere disponibile la stessa anteprima della mappa e indicare il passaggio corrente. Il Master SHALL poter tornare indietro e accedere direttamente ai passaggi di una scena esistente, risolvendo prima eventuali modifiche non salvate. Gli encounter SHALL essere facoltativi e una scena SHALL poter contenerne più di uno. Il passaggio Encounter SHALL gestire gli incontri; il passaggio Mostri e PNG SHALL gestire le figure associate e la loro collocazione. Navigare fra i passaggi SHALL NOT attivare scene né avviare combattimenti.

#### Scenario: Preparazione senza encounter

- **WHEN** il Master prepara una mappa senza encounter
- **THEN** può attraversare Encounter e Mostri e PNG e raggiungere il riepilogo conservando una scena valida senza incontri o figure

#### Scenario: Modifica mirata

- **WHEN** il Master riapre una scena esistente e seleziona Luci e visuale
- **THEN** accede ai controlli delle luci senza ripetere la creazione della base o degli encounter e l'anteprima mantiene la stessa geometria

#### Scenario: Accesso Player

- **WHEN** un Adventurer visualizza la sessione
- **THEN** il wizard e i documenti delle scene inattive non sono disponibili

#### Scenario: Passaggio successivo alla creazione di un encounter

- **WHEN** il Master salva un encounter e continua dal passaggio Encounter
- **THEN** accede a Mostri e PNG, dove può selezionare l'encounter salvato prima di creare le figure, senza dover tornare a modificarlo

### Requirement: Bozze e salvataggi espliciti

Il wizard SHALL distinguere modifiche salvate, bozze di campi e gesti non confermati. Le bozze di Base e dei campi luce SHALL richiedere un salvataggio esplicito; un gesto completato SHALL seguire la conferma del relativo strumento. Navigazione, cambio scena e chiusura con campi modificati SHALL offrire salvataggio, scarto oppure permanenza nel passaggio. La stessa scelta SHALL essere richiesta prima di cambiare l'encounter di destinazione con una bozza di figura o collocazione modificata. Scegliere di restare SHALL conservare bozza ed encounter corrente; scegliere di salvare SHALL completare il salvataggio nell'encounter originale prima del cambio. Un gesto incompleto SHALL essere annullato al cambio di passaggio, scena, encounter o strumento senza essere salvato. Un salvataggio fallito SHALL lasciare il Master sul passaggio e sull'encounter correnti con un motivo leggibile; un conflitto SHALL riallineare la base alla versione autorevole senza sovrascriverla automaticamente. I contenuti già salvati SHALL essere recuperabili riaprendo la scena; le bozze non confermate SHALL NOT essere presentate come persistite.

#### Scenario: Salva e continua

- **WHEN** il Master modifica la calibrazione e usa Salva e continua
- **THEN** il passaggio successivo viene aperto soltanto dopo il salvataggio riuscito della configurazione

#### Scenario: Cambio passaggio con campi modificati

- **WHEN** il Master tenta di lasciare un passaggio con campi non salvati e sceglie di restare
- **THEN** conserva la bozza e il passaggio corrente senza mutazioni

#### Scenario: Cambio passaggio durante un gesto

- **WHEN** il Master cambia passaggio mentre sta tracciando un muro non confermato
- **THEN** la bozza del gesto scompare e nessun muro viene aggiunto

#### Scenario: Versione obsoleta

- **WHEN** un salvataggio viene rifiutato perché un altro Master ha aggiornato la scena
- **THEN** il wizard mostra il conflitto e la versione corrente senza avanzare né pubblicare la bozza obsoleta

#### Scenario: Cambio encounter con figura non salvata

- **WHEN** il Master sta creando un PNG nell'encounter A, seleziona B e sceglie di restare
- **THEN** la selezione rimane A, la bozza è conservata e nessuna scrittura è inviata

#### Scenario: Salvataggio prima del cambio encounter

- **WHEN** il Master ha una bozza valida nell'encounter A, seleziona B e sceglie di salvare
- **THEN** la figura è salvata in A prima di mostrare B e la bozza non viene trasferita in B

#### Scenario: Scarto prima del cambio encounter

- **WHEN** il Master cambia da A a B e sceglie di scartare la bozza modificata
- **THEN** vede B senza salvare la bozza né conservare la selezione di una figura di A

#### Scenario: Conflitto durante il cambio encounter

- **WHEN** il salvataggio richiesto per cambiare encounter viene rifiutato per versione obsoleta
- **THEN** il wizard non completa il cambio, mostra la versione corrente e richiede una nuova azione del Master

### Requirement: Riepilogo e attivazione separati

Il riepilogo SHALL presentare base, dimensioni, pareti, luci, encounter e figure salvati e consentire di tornare al relativo passaggio. SHALL distinguere i collegamenti Encounter e Mostri e PNG e indicare il numero di incontri, di figure preparate e di istanze collocate. SHALL distinguere scena attiva e preparazione privata. L'attivazione e l'attivazione con trasferimento del party SHALL richiedere comandi espliciti dal riepilogo, con le verifiche di versione, round, layout e autorizzazione esistenti. Salvare una modifica della scena attiva SHALL mantenere la pubblicazione corrente dopo il commit; salvare una scena inattiva SHALL NOT distribuirne i contenuti ai Player.

#### Scenario: Preparazione senza attivazione

- **WHEN** il Master completa i passaggi e chiude una scena inattiva dopo i salvataggi
- **THEN** può riprendere i contenuti preparati e il party resta nella scena corrente

#### Scenario: Scena attiva modificata

- **WHEN** il Master conferma una modifica valida alle luci o alle pareti della scena attiva
- **THEN** i client ricevono la configurazione confermata senza attendere una seconda attivazione

#### Scenario: Trasferimento divenuto obsoleto

- **WHEN** il Master conferma un trasferimento la cui preview non corrisponde più alle versioni correnti
- **THEN** il server lo rifiuta senza attivazione o trasferimento parziale e il wizard richiede una nuova preview

#### Scenario: Ritorno alle figure dal riepilogo

- **WHEN** una scena contiene due incontri, tre figure e cinque istanze collocate e il Master seleziona Mostri e PNG dal riepilogo
- **THEN** il riepilogo distingue i tre conteggi e il collegamento apre il passaggio delle figure mantenendo l'anteprima della scena

## ADDED Requirements

### Requirement: Selezione dell'encounter per mostri e PNG

Nel passaggio Mostri e PNG il Master SHALL selezionare esplicitamente un encounter già salvato nella scena corrente prima di creare o modificare figure e collocazioni. L'interfaccia SHALL mostrare il nome dell'encounter scelto e soltanto le sue figure e collocazioni. Senza selezione SHALL mostrare un invito alla scelta senza abilitare mutazioni di figure; senza encounter SHALL offrire un collegamento al passaggio Encounter. Cambiare scena SHALL azzerare la selezione; tornare al passaggio nella stessa scena SHALL conservare una selezione ancora valida. Un encounter rimosso o non più presente nella versione corrente SHALL NOT restare un destinatario utilizzabile.

Il Master SHALL poter aggiungere sia mostri sia PNG, modificarne i dati e collocarne istanze singole o in quantità usando le operazioni versionate esistenti. La preparazione di una figura SHALL NOT collocarla automaticamente né creare un personaggio giocante. La collocazione interattiva nella preview SHALL essere disponibile soltanto nel passaggio Mostri e PNG e SHALL annullare eventuali gesti incompleti all'uscita. Figure e collocazioni già salvate SHALL mantenere identificatori, proprietà e collegamenti senza richiedere una conversione.

#### Scenario: Scelta prima della creazione

- **WHEN** il Master apre Mostri e PNG senza una selezione in una scena con due encounter
- **THEN** può scegliere uno dei due incontri e solo dopo la scelta accede ai controlli per creare le figure

#### Scenario: Mostro e PNG nello stesso encounter

- **WHEN** il Master sceglie A e crea un mostro e un PNG
- **THEN** entrambe le figure risultano associate ad A e non sono mostrate fra le figure di B

#### Scenario: Nessun incontro preparato

- **WHEN** il Master apre Mostri e PNG in una scena senza encounter
- **THEN** vede come tornare a creare un encounter e può anche continuare al riepilogo senza mutazioni

#### Scenario: Riapertura di una preparazione esistente

- **WHEN** il Master riapre una scena con figure e collocazioni create prima del nuovo passaggio e seleziona il relativo incontro
- **THEN** ritrova quei contenuti con gli stessi identificatori e può modificarli o aprirne le schede disponibili

#### Scenario: Cambio scena o rimozione dell'incontro

- **WHEN** il Master cambia scena o la versione autorevole non contiene più l'encounter selezionato
- **THEN** nessuna creazione può essere inviata al precedente encounter e il nuovo passaggio richiede una selezione valida

#### Scenario: Collocazione confinata al passaggio

- **WHEN** il Master passa da Mostri e PNG a Encounter durante un trascinamento non completato
- **THEN** il gesto è annullato e la preview non offre più controlli di collocazione finché non riapre Mostri e PNG
