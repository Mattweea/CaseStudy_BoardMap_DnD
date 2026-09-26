## MODIFIED Requirements

### Requirement: Collegamento esplicito tra scheda e token

Le modifiche accettate a nome, punti ferita massimi, attuali e temporanei e velocità SHALL aggiornare i valori corrispondenti del token associato. Per il token canonico di un personaggio, i punti ferita SHALL essere sempre quelli della scheda: una modifica diretta al token SHALL NOT cambiarli, e il campo degli HP attuali della scheda SHALL accettare anche un danno `-N` o una cura `+N` secondo la capability `hit-points`. Il modificatore di iniziativa proiettato sul token SHALL essere quello calcolato dalle regole: il sistema SHALL ricalcolarlo e proiettarlo quando cambia il punteggio di Destrezza o il bonus vari dell'iniziativa, e SHALL NOT proiettare un valore di iniziativa scritto a mano. Il ritratto e la Classe Armatura SHALL restare dati della scheda e SHALL NOT essere copiati automaticamente sul token.

#### Scenario: Aggiornamento di un valore condiviso

- **WHEN** un utente autorizzato modifica nella scheda un valore collegato al token
- **THEN** il token associato riceve il nuovo valore senza richiedere un aggiornamento della pagina

#### Scenario: Aggiornamento dell'iniziativa per via indiretta

- **WHEN** un utente autorizzato cambia il punteggio di Destrezza o il bonus vari dell'iniziativa
- **THEN** il token riceve il modificatore di iniziativa ricalcolato, senza che alcun campo di iniziativa venga scritto nella scheda

#### Scenario: Aggiornamento di un valore non condiviso

- **WHEN** un utente modifica il ritratto o la Classe Armatura
- **THEN** il token non viene modificato da quel cambiamento

#### Scenario: Punti ferita modificati dal token

- **WHEN** una scrittura della mappa porta sul token canonico di un personaggio HP diversi da quelli della scheda
- **THEN** il token conserva gli HP della scheda
