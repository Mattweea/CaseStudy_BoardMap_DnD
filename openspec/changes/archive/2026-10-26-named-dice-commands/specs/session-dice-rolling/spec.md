## MODIFIED Requirements

### Requirement: Log distinguibile nella tab Chat + Dadi

La tab Chat + Dadi SHALL mostrare i tiri che il partecipante è autorizzato a vedere, distinguendo chiaramente i propri tiri segreti dai tiri pubblici. Il log in P0.3 SHALL funzionare senza una chat testuale. Ogni voce SHALL usare la stessa forma di card qualunque sia l'origine del tiro, libera o dalla scheda del personaggio. La card SHALL mostrare la formula del tiro con un peso tipografico inferiore a quello del totale, che SHALL restare l'elemento dominante; quando il tiro comprende più gruppi, la formula mostrata SHALL rappresentare tutti i gruppi e non soltanto il primo. Il dettaglio dei singoli dadi SHALL essere raggiungibile attivando il totale e SHALL NOT dipendere dal solo passaggio del mouse. Le icone dei dadi nel dettaglio SHALL essere le stesse usate dai controlli di lancio. Una voce originata dalla scheda SHALL aggiungere l'azione che ha prodotto il tiro; una voce libera con nome esplicito SHALL mostrare quel nome come didascalia testuale separata dalla formula; una voce senza azione d'origine e senza nome SHALL NOT ripetere la formula come didascalia.

#### Scenario: Log dell'autore

- **WHEN** l'autore consulta il proprio log dopo tiri pubblici e segreti
- **THEN** vede entrambi e riconosce quali sono segreti

#### Scenario: Dettaglio del risultato

- **WHEN** un partecipante seleziona il totale di un tiro nel log
- **THEN** vede i singoli dadi con il loro risultato e il subtotale dei dadi, separato dal modificatore già espresso nella formula

#### Scenario: Stessa card per origini diverse

- **WHEN** un partecipante confronta nel log un tiro libero senza nome e un tiro originato dalla scheda
- **THEN** le due voci hanno la stessa struttura, entrambe mostrano la formula e aprono il dettaglio allo stesso modo, e differiscono soltanto perché quella dalla scheda riporta anche l'azione d'origine

#### Scenario: Formula completa di un tiro a più gruppi

- **WHEN** un partecipante consulta una voce prodotta da due gruppi di dado, per esempio il danno di un attacco con due blocchi
- **THEN** la formula mostrata comprende entrambi i gruppi e corrisponde ai dadi elencati nel dettaglio

#### Scenario: Dettaglio raggiungibile senza puntatore

- **WHEN** un partecipante raggiunge il totale di un tiro dalla scheda usando soltanto la tastiera e lo attiva
- **THEN** il dettaglio dei dadi si apre, senza che sia necessario passare il mouse sul totale

#### Scenario: Voce con più risultati

- **WHEN** una voce contiene più risultati, come la coppia di un `1d20` o i gruppi di un danno misto
- **THEN** ogni totale ha il proprio comando di attivazione e un unico dettaglio mostra i dadi di tutti i risultati

#### Scenario: Icone coerenti fra log e controlli di lancio

- **WHEN** un partecipante confronta l'icona di un `d8` nel dettaglio di una voce con quella del `d8` nei controlli di lancio
- **THEN** le due icone sono la stessa rappresentazione


#### Scenario: Tiro libero con nome esplicito

- **WHEN** il partecipante consulta un tiro libero con nome attacco con ascia
- **THEN** la card mostra quel nome, formula e totale distinti e il dettaglio resta accessibile dal totale
