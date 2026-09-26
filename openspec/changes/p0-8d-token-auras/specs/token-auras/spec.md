## Purpose

Permettere a un personaggio di definire nella propria scheda le aure che proietta, di accenderle e spegnerle dal token, di mostrarne l'area sulla griglia e di avvisare chi ci si trova dentro, senza applicarne alcun effetto: ricordarlo e applicarlo resta compito dei giocatori.

## ADDED Requirements

### Requirement: Definizione delle aure nella scheda

La tab `Personaggio e combattimento` della scheda SHALL offrire una sezione «Aure» in cui il proprietario e il Master possono creare, modificare e rimuovere le aure del personaggio. Ogni aura SHALL avere:

- **nome:** testo di al massimo 60 caratteri; un nome vuoto SHALL essere mostrato come «Aura»;
- **descrizione:** testo libero;
- **effetto:** testo di al massimo 500 caratteri;
- **raggio:** un numero intero di caselle da 1 a 24, inserito e mostrato nell'unità di misura della partita. Un valore che non è un multiplo esatto di una casella SHALL essere arrotondato alla casella più vicina, con un minimo di una casella;
- **colore:** uno di una palette chiusa di colori;
- **stato:** acceso o spento. Un'aura nuova SHALL nascere spenta.

Un personaggio SHALL avere al massimo 10 aure. La sezione SHALL NOT offrire modelli precompilati. Il server SHALL rifiutare con un errore di validazione una modifica che viola questi limiti o che usa un colore fuori dalla palette, senza applicare nulla della patch. Un altro Adventurer SHALL NOT poter leggere o modificare le aure di una scheda che non è sua. Una scheda salvata prima di questa capability SHALL caricarsi con un elenco di aure vuoto.

#### Scenario: Creazione di un'aura

- **WHEN** un Adventurer apre la propria scheda, aggiunge un'aura «Aura di protezione» con raggio 3 m in una partita con caselle da 1,5 m, e conferma
- **THEN** l'aura compare nella sezione con raggio 2 caselle, mostrato come 3 m, ed è spenta

#### Scenario: Raggio non multiplo della casella

- **WHEN** in una partita con caselle da 1,5 m un Adventurer inserisce un raggio di 4 m
- **THEN** l'aura viene salvata con raggio 3 caselle e mostrata come 4,5 m

#### Scenario: Limite di aure

- **WHEN** un Adventurer con 10 aure prova ad aggiungerne un'undicesima
- **THEN** l'aggiunta viene rifiutata e le 10 aure esistenti restano invariate

#### Scenario: Colore fuori dalla palette

- **WHEN** un client invia una patch che imposta il colore di un'aura a un valore fuori dalla palette
- **THEN** il server rifiuta la patch con un errore di validazione e la scheda non cambia

#### Scenario: Scheda di un altro personaggio

- **WHEN** un Adventurer prova a modificare un'aura nella scheda di un altro personaggio
- **THEN** la richiesta viene rifiutata come non autorizzata e la scheda non cambia

#### Scenario: Scheda salvata prima delle aure

- **WHEN** il server carica una scheda salvata senza aure
- **THEN** la scheda si apre con la sezione «Aure» vuota e senza errori

### Requirement: Proiezione delle aure sul token

Il token canonico del personaggio, non il famiglio, SHALL riportare per ogni aura della scheda il nome, l'effetto, il raggio, il colore e lo stato. La descrizione SHALL NOT raggiungere lo stato condiviso della mappa né alcun partecipante diverso dal proprietario e dal Master. Una modifica accettata alle aure della scheda SHALL aggiornare il token e raggiungere gli altri partecipanti senza ricaricare la pagina.

Le aure del token SHALL essere determinate solo dalla scheda. Il server SHALL ignorare le aure inviate da un client in qualunque scrittura della mappa, compreso l'aggiornamento di un token proprio e il commit a stato pieno del Master, e SHALL ricalcolarle dalla scheda ogni volta che installa uno stato della mappa, compresi annullamento del Master e ripresa di una sessione salvata. Un token senza scheda collegata, come un nemico, un oggetto, un veicolo o un famiglio, SHALL NOT avere aure. Le aure presenti in uno snapshot salvato prima di questa capability, nel vecchio formato, SHALL essere scartate al caricamento.

#### Scenario: Descrizione privata

- **WHEN** un Adventurer definisce un'aura con descrizione ed effetto, e un secondo Adventurer riceve lo stato della mappa
- **THEN** il secondo Adventurer riceve nome, effetto, raggio, colore e stato dell'aura, ma non la descrizione

#### Scenario: Aure inviate da un client

- **WHEN** il Master invia un commit a stato pieno in cui un token nemico ha un'aura e un token personaggio ha un'aura diversa da quella della sua scheda
- **THEN** il commit viene accettato, il nemico non ha aure e il personaggio ha le aure della propria scheda

#### Scenario: Snapshot con aure legacy

- **WHEN** il Master riprende una sessione salvata in cui un nemico e un personaggio hanno aure nel vecchio formato
- **THEN** il nemico non ha aure e il personaggio ha le aure della propria scheda

#### Scenario: Annullamento del Master

- **WHEN** un Adventurer accende un'aura e poi il Master annulla una propria modifica precedente
- **THEN** l'aura resta accesa, come nella scheda

### Requirement: Accensione e spegnimento autorizzati

Il proprietario del personaggio e il Master SHALL poter accendere e spegnere ogni aura del personaggio, dal menu radiale del token o dalla scheda. L'interruttore SHALL cambiare solo lo stato dell'aura indicata, SHALL funzionare in ogni modalità di sessione e SHALL aggiornare insieme la scheda e il token. Un Adventurer SHALL NOT poter cambiare lo stato di un'aura di un altro personaggio; il server SHALL rifiutare la richiesta come non autorizzata. Una richiesta per un'aura inesistente SHALL essere rifiutata come risorsa mancante. Una richiesta che porta un'aura nello stato che ha già SHALL essere accettata senza cambiare la versione della mappa. In caso di rifiuto, il client SHALL riallineare lo stato mostrato a quello del server e mostrare il motivo.

Nessuna aura SHALL spegnersi da sola, qualunque condizione abbia il proprietario. L'interruttore SHALL NOT essere annullabile con il comando di annullamento: si corregge usando di nuovo l'interruttore.

#### Scenario: Accensione dal proprietario

- **WHEN** un Adventurer accende una propria aura in Esplorazione
- **THEN** l'aura risulta accesa nella scheda e sul token, e tutti i partecipanti la vedono sulla mappa

#### Scenario: Aura di un altro personaggio

- **WHEN** un Adventurer prova ad accendere l'aura di un altro personaggio
- **THEN** la richiesta viene rifiutata come non autorizzata e l'aura resta spenta

#### Scenario: Master sull'aura di un personaggio

- **WHEN** il Master spegne l'aura accesa di un personaggio
- **THEN** l'aura risulta spenta nella scheda e sul token

#### Scenario: Proprietario privo di sensi

- **WHEN** il proprietario di un'aura accesa diventa Privo di sensi
- **THEN** l'aura resta accesa

#### Scenario: Aura rimossa nel frattempo

- **WHEN** un Adventurer attiva l'interruttore di un'aura che il Master ha appena rimosso dalla scheda
- **THEN** la richiesta viene rifiutata, il menu si riallinea senza quell'aura e il motivo viene mostrato

### Requirement: Area secondo la griglia del PHB

L'area di un'aura accesa SHALL essere calcolata con la regola della griglia del PHB, in cui ogni casella costa 1, diagonali comprese. La regola SHALL valere sempre, qualunque regola delle diagonali abbia scelto il Master per il movimento. L'area SHALL essere l'insieme delle caselle a distanza non superiore al raggio da almeno una casella occupata dal token, cioè il rettangolo dell'ingombro del token allargato del raggio su ogni lato. Un token SHALL trovarsi dentro un'aura quando almeno una sua casella cade nell'area.

La mappa SHALL disegnare l'area di ogni aura accesa con il colore dell'aura. Dove due o più aree si sovrappongono, i riempimenti SHALL combinare i colori con fusione moltiplicativa, così la zona comune è riconoscibile; i bordi SHALL mantenere il colore originale di ciascuna aura. Le aure spente SHALL NOT essere disegnate. L'aura di un token contenuto in un veicolo SHALL NOT essere disegnata né contare per la presenza.

#### Scenario: Aura attorno a un token medio

- **WHEN** un personaggio di taglia Media accende un'aura di 2 caselle
- **THEN** l'area disegnata è un quadrato di 5×5 caselle centrato sul token

#### Scenario: Aura attorno a un token grande

- **WHEN** un token 2×2 accende un'aura di 1 casella
- **THEN** l'area disegnata è un quadrato di 4×4 caselle attorno al token

#### Scenario: Variante 5-10-5 attiva

- **WHEN** il Master ha scelto la variante 5-10-5 e un personaggio accende un'aura di 2 caselle
- **THEN** la casella in diagonale a due passi dal token, che il righello misura 3 caselle, è dentro l'area

#### Scenario: Presenza con un solo angolo

- **WHEN** un token 2×2 ha una sola casella dentro l'area di un'aura
- **THEN** il token risulta dentro l'aura

#### Scenario: Aure sovrapposte

- **WHEN** due aure accese di colori diversi coprono in parte le stesse caselle
- **THEN** la zona comune mostra i colori combinati con fusione moltiplicativa, mentre entrambi i bordi conservano il proprio colore

### Requirement: Visibilità delle aure

Le aure accese SHALL essere visibili a ogni partecipante che riceve il token del proprietario. Un'aura SHALL NOT raggiungere, né come area né come avviso, un partecipante che non riceve il token del proprietario, per esempio perché il Master lo ha nascosto.

#### Scenario: Aura visibile a tutti

- **WHEN** un Adventurer accende un'aura
- **THEN** il Master e gli altri Adventurer ne vedono l'area sulla mappa

#### Scenario: Proprietario nascosto dal Master

- **WHEN** il Master nasconde il token di un personaggio con un'aura accesa e un altro Adventurer ha il proprio token dentro l'area
- **THEN** l'altro Adventurer non riceve né l'area né l'avviso di quell'aura

### Requirement: Avviso di presenza in un'aura

Un Adventurer con un proprio token dentro l'aura accesa di un altro personaggio SHALL vedere in alto al centro della mappa, anche a schermo intero, un avviso persistente con una riga per ogni aura: «Sei nell'aura di <personaggio>: <nome>» per il token canonico, «<famiglio> è nell'aura di <personaggio>: <nome>» per un famiglio. La forma SHALL restare grammaticalmente corretta qualunque sia il nome dell'aura. Ogni riga SHALL poter essere espansa, con il mouse o con la tastiera, per leggere l'effetto dell'aura.

L'avviso SHALL restare visibile finché il token è dentro l'area e l'aura è accesa, e SHALL aggiornarsi senza ricaricare la pagina quando un token entra o esce, quando un'aura si accende o si spegne o quando ne cambia il raggio. Un'aura del proprio personaggio SHALL NOT produrre avvisi per i token dello stesso proprietario. Il Master SHALL NOT ricevere avvisi. L'ingresso in una nuova aura SHALL essere annunciato alle tecnologie assistive senza spostare il fuoco.

#### Scenario: Ingresso nell'aura di un alleato

- **WHEN** un Adventurer muove il proprio token in una casella dell'area accesa «Aura di protezione» di Ilthar
- **THEN** compare in alto l'avviso «Sei nell'aura di Ilthar: Aura di protezione»

#### Scenario: Lettura dell'effetto

- **WHEN** l'Adventurer espande la riga dell'avviso con la tastiera
- **THEN** l'avviso mostra l'effetto dell'aura

#### Scenario: Uscita dall'aura

- **WHEN** l'Adventurer muove il proprio token fuori dall'area
- **THEN** l'avviso sparisce

#### Scenario: Aura spenta

- **WHEN** il proprietario spegne l'aura mentre l'Adventurer è dentro l'area
- **THEN** l'avviso sparisce per l'Adventurer

#### Scenario: Due aure insieme

- **WHEN** il token di un Adventurer è dentro due aure accese di personaggi diversi
- **THEN** l'avviso mostra due righe, una per aura

#### Scenario: Famiglio nell'aura

- **WHEN** il famiglio di un Adventurer entra nell'area accesa di un altro personaggio
- **THEN** l'Adventurer vede una riga che nomina il famiglio

#### Scenario: Aura propria

- **WHEN** un Adventurer accende una propria aura con il proprio token e il proprio famiglio dentro l'area
- **THEN** l'Adventurer non riceve alcun avviso per quell'aura

#### Scenario: Master

- **WHEN** un token nemico si trova dentro l'aura accesa di un personaggio
- **THEN** il Master vede l'area sulla mappa e non riceve alcun avviso
