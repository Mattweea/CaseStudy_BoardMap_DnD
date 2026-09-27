## MODIFIED Requirements

### Requirement: Ritratto personale sostituibile

Il proprietario e il Master SHALL poter sostituire il ritratto del personaggio con un file JPEG, PNG o WebP di massimo 5 MB. Il server SHALL verificare dimensione e tipo effettivo, SHALL usare un nome generato in una directory gestita e SHALL sostituire il file precedente senza lasciare il record in uno stato incoerente. Il ritratto aggiornato SHALL apparire nella scheda, nel roster e come immagine visiva del token canonico del personaggio per ogni partecipante che vede quel token, senza ricaricare la pagina. I token senza ritratto caricato SHALL mantenere la propria immagine; familiari, nemici, oggetti e veicoli SHALL mantenere la propria immagine. Il ritratto SHALL NOT essere copiato nel dato condiviso del token.

#### Scenario: Upload valido del ritratto

- **WHEN** un utente autorizzato carica un JPEG, PNG o WebP valido entro 5 MB
- **THEN** il sistema salva il nuovo ritratto con un nome gestito e lo mostra nella scheda, nel roster e sul token canonico del personaggio per i partecipanti che lo vedono

#### Scenario: File non valido

- **WHEN** l'utente carica un file oltre 5 MB, con tipo non ammesso o con contenuto incompatibile con il tipo dichiarato
- **THEN** il sistema rifiuta il file e mantiene disponibile il ritratto precedente anche sul token

#### Scenario: Ritratto e token restano distinti

- **WHEN** il ritratto della scheda viene sostituito
- **THEN** l'immagine visiva del token canonico cambia ma il suo dato immagine nello stato condiviso resta distinto; i token familiari, nemici, oggetti e veicoli mantengono le proprie immagini

#### Scenario: Nessun ritratto caricato

- **WHEN** un personaggio non ha caricato un ritratto nella scheda
- **THEN** il suo token mantiene l'immagine già assegnata

### Requirement: Collegamento esplicito tra scheda e token

Le modifiche accettate a nome, punti ferita massimi, attuali e temporanei e velocità SHALL aggiornare i valori corrispondenti del token associato. Per il token canonico di un personaggio, i punti ferita SHALL essere sempre quelli della scheda: una modifica diretta al token SHALL NOT cambiarli, e il campo degli HP attuali della scheda SHALL accettare anche un danno `-N` o una cura `+N` secondo la capability `hit-points`. Il modificatore di iniziativa proiettato sul token SHALL essere quello calcolato dalle regole: il sistema SHALL ricalcolarlo e proiettarlo quando cambia il punteggio di Destrezza o il bonus vari dell'iniziativa, e SHALL NOT proiettare un valore di iniziativa scritto a mano. La Classe Armatura SHALL restare un dato della scheda; il ritratto SHALL essere usato come immagine visiva del token canonico senza essere copiato nel suo stato condiviso.

#### Scenario: Aggiornamento di un valore condiviso

- **WHEN** un utente autorizzato modifica nella scheda un valore collegato al token
- **THEN** il token associato riceve il nuovo valore senza richiedere un aggiornamento della pagina

#### Scenario: Aggiornamento dell'iniziativa per via indiretta

- **WHEN** un utente autorizzato cambia il punteggio di Destrezza o il bonus vari dell'iniziativa
- **THEN** il token riceve il modificatore di iniziativa ricalcolato, senza che alcun campo di iniziativa venga scritto nella scheda

#### Scenario: Aggiornamento di un valore non condiviso

- **WHEN** un utente modifica la Classe Armatura
- **THEN** il token non viene modificato da quel cambiamento

#### Scenario: Ritratto del token canonico

- **WHEN** un utente sostituisce il ritratto della scheda
- **THEN** l'immagine visiva del token canonico si aggiorna senza modificare lo stato condiviso della mappa

#### Scenario: Punti ferita modificati dal token

- **WHEN** una scrittura della mappa porta sul token canonico di un personaggio HP diversi da quelli della scheda
- **THEN** il token conserva gli HP della scheda
