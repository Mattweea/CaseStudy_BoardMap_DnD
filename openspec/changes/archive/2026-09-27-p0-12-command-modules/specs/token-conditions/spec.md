## MODIFIED Requirements

### Requirement: Menu accessibile da tastiera

Il menu radiale SHALL aprirsi anche con `S` o con `Shift+F10` sul token che ha il fuoco da tastiera, alle stesse condizioni del click destro. Le scorciatoie SHALL restare inerti mentre il fuoco è in un campo di testo e mentre un'interazione di mappa è in corso. Nel menu:

- le voci, compreso il selettore del livello di Indebolimento, SHALL essere raggiungibili con i tasti freccia e attivabili con `Invio` o `Spazio`;
- ogni condizione SHALL avere un tasto d'accesso di una lettera, unico nel catalogo del tipo di token e mostrato nell'etichetta, che la attiva direttamente come la sua voce, anche dalla corona quando la condizione sta nel pannello `+`; «Alzati» SHALL avere un proprio tasto d'accesso, distinto da quello di Prono; «Aure» SHALL avere un proprio tasto d'accesso, distinto da quelli delle condizioni e di «Alzati», che apre il pannello delle aure;
- nel pannello delle aure gli interruttori SHALL essere raggiungibili con i tasti freccia, attivabili con `Invio` o `Spazio` e annunciare nome e stato, ed `Esc` SHALL riportare alla corona;
- i tasti da `0` a `6` SHALL impostare direttamente il livello di Indebolimento di una creatura;
- quando il menu mostra l'icona dei punti ferita, i tasti `-` e `+` SHALL aprire direttamente il campo dei punti ferita con il segno già scritto; mentre il campo ha il fuoco, i tasti digitati SHALL andare al campo e SHALL NOT attivare condizioni, azioni o livelli di Indebolimento;
- ogni condizione SHALL annunciare il proprio nome e il proprio stato attivo o inattivo;
- i tasti gestiti dal menu SHALL NOT raggiungere le scorciatoie della mappa: frecce, lettere, `Canc` e `Backspace` premuti nel menu SHALL NOT muovere, cancellare il token o attivare uno strumento di mappa;
- la chiusura SHALL restituire il fuoco al token.

La guida della tab Moduli SHALL documentare questi comandi per ogni ruolo che può usarli: il modulo «Condizioni» SHALL elencare il click destro, `S`, `Shift+F10`, i tasti d'accesso delle condizioni e di «Alzati» e i tasti `0`-`6`; il modulo «Aure» SHALL elencare il tasto d'accesso di «Aure»; il modulo «Punti ferita» SHALL elencare i tasti `-` e `+`.

#### Scenario: Menu da tastiera

- **WHEN** un Adventurer porta il fuoco sul proprio token e preme `S`
- **THEN** il menu si apre con il fuoco sulla prima voce, e dopo `Esc` il fuoco torna al token

#### Scenario: Condizione con il tasto d'accesso

- **WHEN** un Adventurer porta il fuoco sul proprio token in piedi, preme `S` e poi `P`
- **THEN** il token diventa Prono e il menu resta aperto

#### Scenario: Frecce nel menu

- **WHEN** il Master ha selezionato un token, ne apre il menu e preme freccia destra e poi `Canc`
- **THEN** il fuoco passa alla voce successiva e il token non si muove né viene cancellato

#### Scenario: Tasto S mentre si scrive

- **WHEN** il fuoco è nella textarea dei comandi e l'utente scrive `s`
- **THEN** nessun menu si apre

#### Scenario: Aura da tastiera

- **WHEN** un Adventurer con un'aura spenta porta il fuoco sul proprio token, preme `S`, poi il tasto d'accesso di «Aure» e poi `Invio`
- **THEN** l'aura si accende, il suo nuovo stato viene annunciato e il token non si muove

#### Scenario: Danno da tastiera

- **WHEN** un Adventurer porta il fuoco sul proprio token con 12 HP, preme `S`, poi `-`, `3` e `Invio`
- **THEN** il PG ha 9 HP, il menu resta aperto e il livello di Indebolimento non cambia

#### Scenario: Esc nel campo dei punti ferita

- **WHEN** chi ha aperto il campo dei punti ferita con `+` preme `Esc`
- **THEN** il campo si chiude senza applicare nulla, il fuoco torna all'icona e il menu resta aperto

#### Scenario: Comandi del menu nella guida

- **WHEN** un Adventurer apre i moduli «Condizioni», «Aure» e «Punti ferita» nella tab Moduli
- **THEN** trova il click destro, `S`, `Shift+F10`, ogni tasto d'accesso delle condizioni, `L` per «Alzati», `U` per «Aure», i tasti `0`-`6` e i tasti `-` e `+`
