## MODIFIED Requirements

### Requirement: Audio di combattimento locale e controllabile

Gli effetti sonori del combattimento — annuncio d'avvio, «Sei il prossimo!» e «Tocca a te!» — SHALL provenire da asset locali con licenza che ne consente la ridistribuzione. L'annuncio d'avvio SHALL usare l'effetto [29 Gen Combat Start Advantage](https://www.101soundboards.com/sounds/42066404-29-gen-combat-start-advantage); i due avvisi di turno SHALL usare entrambi l'effetto [87 UI Town DungeonProgress](https://www.101soundboards.com/sounds/42066405-87-ui-town-dungeonprogress). Questi suoni SHALL essere uguali per tutti i partecipanti e SHALL NOT essere selezionabili individualmente. Ogni partecipante SHALL poter silenziare questi suoni e regolarne il volume con preferenze salvate solo nel proprio browser, che SHALL NOT modificare l'esperienza degli altri. Un suono SHALL partire solo dopo un'interazione affidabile con la pagina. Un errore di riproduzione SHALL essere silenzioso e SHALL NOT impedire la comparsa dell'avviso visivo. I tiri per colpire SHALL NOT produrre ulteriori suoni di critico o fallimento critico.

#### Scenario: Suono d'ingresso in combattimento

- **WHEN** il Master entra in Combattimento e un partecipante connesso ha attivato l'audio e interagito con la pagina
- **THEN** quel partecipante sente una sola volta l'effetto scelto per l'ingresso in combattimento insieme all'annuncio visivo

#### Scenario: Un solo effetto per i due avvisi di turno

- **WHEN** un partecipante riceve «Sei il prossimo!» o «Tocca a te!» con l'audio attivo dopo aver interagito con la pagina
- **THEN** sente lo stesso effetto scelto per entrambi gli avvisi, una sola volta per nuovo avviso

#### Scenario: Suoni silenziati

- **WHEN** un partecipante ha silenziato i suoni di combattimento e il Master entra in Combattimento
- **THEN** il partecipante vede l'annuncio senza sentire alcun suono, mentre gli altri lo sentono secondo le proprie preferenze

#### Scenario: Riproduzione impossibile

- **WHEN** il browser rifiuta di riprodurre l'effetto sonoro
- **THEN** l'avviso visivo compare comunque e nessun errore è mostrato

#### Scenario: Tiro per colpire

- **WHEN** un tiro per colpire contiene un risultato naturale critico o pari a uno
- **THEN** il tiro e il suo log seguono il comportamento esistente senza un effetto sonoro aggiuntivo di combattimento
