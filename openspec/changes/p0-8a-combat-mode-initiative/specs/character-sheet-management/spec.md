## ADDED Requirements

### Requirement: Modalità del tiro d'iniziativa salvata nella scheda

La scheda SHALL conservare la modalità del tiro d'iniziativa del personaggio fra Normale, Vantaggio e Svantaggio. Accanto al riquadro Iniziativa della tab `Personaggio e combattimento` un comando con icona di impostazioni SHALL aprire un selettore delle tre modalità; la modalità attiva SHALL essere visibile sul riquadro anche a selettore chiuso quando è diversa da Normale. La modalità SHALL essere modificabile da chi può modificare la scheda, con le stesse regole di autorizzazione, versione e conflitto degli altri campi, e SHALL essere sincronizzata dal vivo come ogni altro campo. Il server SHALL rifiutare un valore diverso dalle tre modalità. Una scheda nuova e una scheda salvata prima di questo requisito SHALL assumere la modalità Normale; la modalità SHALL NOT essere dedotta dal profilo del personaggio nel roster, perché la sceglie chi gioca dalla scheda. Cambiare la modalità SHALL NOT avviare un tiro.

#### Scenario: Scelta del Vantaggio

- **WHEN** l'Adventurer apre le impostazioni accanto all'Iniziativa e sceglie Vantaggio
- **THEN** la scheda salva la modalità, il riquadro la indica e il successivo tiro d'iniziativa usa due `d20` tenendo il maggiore

#### Scenario: Valore non ammesso

- **WHEN** una patch della scheda scrive una modalità d'iniziativa diversa da Normale, Vantaggio o Svantaggio
- **THEN** il server rifiuta la patch e la scheda resta invariata

#### Scenario: Scheda esistente di un personaggio con vantaggio nel roster

- **WHEN** viene letta una scheda salvata prima di questo requisito, di un personaggio il cui profilo nel roster dichiara l'iniziativa con vantaggio
- **THEN** la modalità risulta Normale finché chi gioca non sceglie Vantaggio dalla scheda

#### Scenario: Utente senza diritto di modifica

- **WHEN** un Adventurer tenta di cambiare la modalità d'iniziativa della scheda di un altro personaggio
- **THEN** il server rifiuta la modifica con le stesse regole degli altri campi della scheda
