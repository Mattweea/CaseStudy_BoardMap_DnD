## ADDED Requirements

### Requirement: Quantità e creazione atomica

Solo il Master SHALL poter creare un lotto di PG o nemici indicando una quantità intera da 1 a 100, inizialmente 1. Ogni creatura SHALL avere ID e collocamento validi e distinti. Un errore di quantità, autorizzazione, posizionamento o conflitto SHALL lasciare la mappa invariata e mostrare un errore; il sistema SHALL NOT creare account o duplicare automaticamente PG canonici.

#### Scenario: Quattro creature

- **WHEN** il Master conferma 4 nemici validi
- **THEN** compaiono quattro creature con proprietà richieste e ID distinti, in un solo aggiornamento condiviso annullabile

#### Scenario: Quantità non valida

- **WHEN** si conferma 0, un numero negativo, 1.5, un campo vuoto o 101
- **THEN** la richiesta è rifiutata senza creare creature

#### Scenario: Permessi e conflitti

- **WHEN** un Adventurer richiede un lotto oppure il Master invia un lotto basato su uno stato obsoleto
- **THEN** il server rifiuta la richiesta senza applicazioni parziali

### Requirement: Nomina legacy

Il sistema SHALL mantenere il nome base ripulito dagli spazi esterni quando la quantità è 1 e SHALL usare il nome base seguito da spazio e indice da 1 a N quando N è maggiore di 1. La numerazione SHALL ripartire da 1 per ogni nuovo lotto senza rinominare creature preesistenti.

#### Scenario: Un solo nemico

- **WHEN** il Master crea un Diavolo spinato
- **THEN** il nome è Diavolo spinato, senza suffisso

#### Scenario: Quattro nemici

- **WHEN** il Master crea quattro creature con base Diavolo spinato
- **THEN** i nomi sono Diavolo spinato 1, Diavolo spinato 2, Diavolo spinato 3 e Diavolo spinato 4

#### Scenario: Lotto successivo

- **WHEN** esiste già Diavolo spinato 1 e il Master crea un altro lotto di due
- **THEN** il lotto usa i suffissi 1 e 2 e non rinomina gli elementi precedenti



### Requirement: Preparazione e collocazione nelle scene
Il sistema SHALL distinguere definizione della creatura e istanze collocate. Il Master SHALL poter indicare Quantità nel flusso moderno e confermare esplicitamente le posizioni prima della creazione dei placement. Una scena inattiva SHALL conservare soltanto la preparazione e SHALL NOT alterare il runtime attivo. La sola creazione della definizione SHALL NOT collocare creature automaticamente.

#### Scenario: Quattro istanze della stessa definizione
- **WHEN** il Master sceglie una definizione e conferma un lotto di quattro in una scena
- **THEN** vengono persistiti quattro placement distinti con nomi progressivi e la stessa definizione, senza duplicarla

#### Scenario: Scena inattiva o annullamento
- **WHEN** il Master prepara il lotto in una scena inattiva oppure annulla la preview
- **THEN** nel primo caso cambia soltanto la preparazione della scena scelta e nel secondo non viene scritto alcun placement
