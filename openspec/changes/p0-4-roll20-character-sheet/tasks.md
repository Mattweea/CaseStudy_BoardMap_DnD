## 1. Modello dati e dominio

- [x] 1.1 Aggiungere una migrazione additiva per unicità `(owner_user_id, campaign_id)` e metadati nullable del ritratto, con controllo preventivo dei duplicati e rollback; verificare applicazione, rollback e nuova applicazione su un database temporaneo.
- [x] 1.2 Definire tipi, documento iniziale e validazione di `CharacterSheetData` per tutte le tre tab, inclusi ID stabili delle collezioni e percorsi patch ammessi; verificare con test di documenti validi, campi sconosciuti, valori non validi e righe aggiuntive.
- [x] 1.3 Implementare `CharacterSheetRepository` per lettura, creazione idempotente e persistenza atomica di documento, versione e metadati; verificare con test SQLite l'unicità della scheda, la conservazione dei dati dopo riapertura e l'aggiornamento condizionato della versione.
- [x] 1.4 Implementare `CharacterSheetPolicy` per proprietario, Master e altri Adventurer; verificare con test della matrice read/write/subscribe che un Player non riceva dati della scheda altrui.
- [x] 1.5 Implementare il bootstrap idempotente della campagna e delle schede del roster attuale, normalizzando eventuali documenti precedenti riconosciuti; verificare con due bootstrap consecutivi che il numero di schede e i dati esistenti restino invariati.

## 2. Service, concorrenza e persistenza live

- [x] 2.1 Implementare `CharacterSheetService` e lo stato live autorevole per caricamento, validazione e patch granulari con incremento di versione; verificare che una patch valida aggiorni solo i percorsi richiesti e che una patch non valida sia atomica e non cambi lo stato.
- [x] 2.2 Implementare il controllo dei conflitti per percorso e per ID degli elementi ripetibili; verificare con test concorrenti che campi o righe differenti vengano uniti e che lo stesso campo obsoleto produca un conflitto con valore e versione correnti.
- [x] 2.3 Implementare dirty state, debounce SQLite di circa un secondo, retry dopo errore e flush esplicito o globale; verificare con clock controllato che più input causino una sola scrittura e che chiusura scheda, logout e arresto ordinato persistano subito l'ultima versione.
- [x] 2.4 Collegare nome, HP massimi/attuali/temporanei, velocità e modificatore di iniziativa allo stato autorevole del token con proiezione unidirezionale; verificare che tali valori aggiornino il token e che ritratto, Classe Armatura e modifiche dirette al token non riscrivano la scheda.

## 3. API, SSE e ritratto

- [x] 3.1 Esporre route Fastify per leggere, modificare e forzare il flush di una scheda tramite service e policy; verificare con test HTTP i casi proprietario, Master, altro Player, richiesta non autenticata, payload non valido e conflitto `409`.
- [x] 3.2 Estendere lo stream SSE esistente con eventi mirati per patch e stato di persistenza; verificare con connessioni Master, proprietario e altro Player che solo i primi due ricevano dati privati e che lo snapshot della mappa non contenga la scheda.
- [x] 3.3 Aggiungere `@fastify/multipart` e un servizio di storage locale fuori dalla directory pubblica per JPEG, PNG e WebP fino a 5 MB, con firma del file, nome generato, sostituzione atomica e pulizia dei temporanei; verificare upload validi e rifiuto di dimensione, MIME o firma errati senza perdere il ritratto precedente.
- [x] 3.4 Esporre upload e lettura autenticata del ritratto e distribuire al roster il nuovo riferimento opaco; verificare che proprietario e Master possano sostituirlo, che il roster connesso si aggiorni e che l'immagine del token resti invariata.

## 4. Client e finestra della scheda

- [x] 4.1 Implementare client API e `useCharacterSheet` con bozza ottimistica, versioni, riconciliazione SSE, flush e stati `Modifica in corso`, `Salvataggio`, `Salvato` ed errore; verificare con test del hook conferme fuori ordine, errore di persistenza e mantenimento del valore locale durante un conflitto.
- [x] 4.2 Definire il sistema visivo della scheda dal PDF di riferimento con token per carta, inchiostro, grigi, cornici, smussi, spaziatura e tipografia e con componenti riutilizzabili per pannelli, valori sagomati ed etichette; verificare in una pagina campione contrasto, stati focus e coerenza tra i componenti senza riutilizzare logo o illustrazioni originali.
- [x] 4.3 Creare `CharacterSheetWindow` come dialog ampio, accessibile e responsive con focus trap, Escape, ripristino del focus e tre tab; verificare da tastiera che apertura, cambio tab e chiusura conservino sia i valori sia posizione e zoom della mappa sottostante.
- [x] 4.4 Implementare la tab `Personaggio e combattimento` riprendendo la composizione a tre zone della prima pagina del PDF, con tutti i campi, competenze, valute, testi e collezioni ripetibili; verificare gerarchia visiva, compilazione manuale, aggiunta/rimozione di attacchi o azioni e assenza di calcoli automatici.
- [x] 4.5 Implementare la tab `Aspetto e storia` riprendendo i grandi pannelli asimmetrici della seconda pagina, incluso il controllo del ritratto ma senza upload di fazione o allegati; verificare composizione, tutti i campi, anteprima e sostituzione del ritratto e assenza di comandi di importazione.
- [x] 4.6 Implementare la tab `Incantesimi` riprendendo l'intestazione e le tre colonne dense della terza pagina, con trucchetti, livelli 1-9, stato preparato/conosciuto e slot totali/rimanenti; verificare scansione visiva per livello, inserimento manuale e aggiunta di righe oltre quelle del PDF.
- [x] 4.7 Aggiornare la tab Personaggi affinché usi il ritratto corrente e mostri l'apertura della scheda solo al proprietario o al Master, mantenendo la localizzazione del token quando disponibile; verificare la matrice dei comandi con login Master e Player e un profilo senza token.
- [x] 4.8 Adattare la composizione delle tre tab a desktop e viewport stretti conservando l'ordine di lettura del PDF, con sezioni leggibili e una sola tab visibile; verificare assenza di overflow orizzontale, target utilizzabili e navigazione completa da tastiera alle dimensioni supportate dal workspace.
- [x] 4.9 Ridimensionare `CharacterSheetWindow` secondo la reference Roll20, con rapporto desktop circa 1,35:1, larghezza contenuta, altezza prossima al viewport, cornice applicativa sottile e scorrimento verticale interno; rifluire Personaggio in due colonne e Incantesimi in due colonne senza overflow orizzontale.
- [x] 4.10 Rendere la finestra non modale e trascinabile dalla testata tramite puntatore e `Alt` più frecce, confinare e ricontrollare la posizione nel viewport, conservarla localmente e usare un fallback a schermo intero non trascinabile sui viewport stretti; mantenere Escape e ripristino del focus senza intrappolare la tabulazione.
- [x] 4.11 Predisporre confini e identificatori stabili sui controlli relativi a caratteristiche, salvezze, abilità, iniziativa, attacchi e incantesimi per consentire a P0.5 di aggiungere comandi di tiro contestuali senza modificare la larghezza o la griglia; non mostrare né eseguire tiri in P0.4.

## 5. Verifica integrata

- [x] 5.1 Eseguire suite automatica, type-check e build di produzione e correggere ogni regressione introdotta dalla scheda; verificare che tutti i comandi terminino con successo.
- [x] 5.2 Eseguire uno scenario con due browser, Master e Player, modificando prima campi differenti e poi lo stesso campo; verificare aggiornamento senza reload, merge dei campi indipendenti, conflitto comprensibile e nessuna esposizione a un terzo Player.
- [x] 5.3 Verificare persistenza e asset end-to-end modificando più campi rapidamente, chiudendo la scheda, riavviando il server e sostituendo il ritratto; confermare una scrittura raggruppata, recupero dell'ultima versione, roster aggiornato e token invariato per i campi non collegati.
- [x] 5.4 Acquisire screenshot completi delle tre tab a viewport desktop e stretto e confrontarli con le rispettive pagine di `5E_CharacterSheet_Fillable.pdf`; verificare con revisione visiva documentata gerarchia, raggruppamenti, densità, cornici, contrasto, leggibilità e assenza di sovrapposizioni o contenuti tagliati.
- [x] 5.5 Verificare a viewport desktop e stretto proporzioni, drag tramite puntatore e tastiera, clamping dopo resize, persistenza della posizione, interazione con la mappa scoperta, assenza di overflow e regressioni di build e test; acquisire screenshot della finestra compatta nel workspace.

## 6. Riorganizzazione della tab Personaggio e combattimento

- [x] 6.1 Riscrivere il modello dati della tab: sostituire `classLevel` con classe, sottoclasse, livello e razza accanto a background, allineamento e punti esperienza; rimuovere la collezione `actions` e la moneta Electrum; trasformare equipaggiamento, competenze, linguaggi e privilegi in collezioni ripetibili e aggiungere le sezioni di risorse; verificare con test che il documento iniziale sia valido, che i percorsi patch nuovi siano ammessi e che azioni e `ep` siano rifiutati.
- [x] 6.2 Normalizzare i documenti scritti prima della riorganizzazione portando i testi riconosciuti nella prima riga della collezione corrispondente e scartando i campi non più previsti; verificare con un test di normalizzazione che nessun testo utente venga perso.
- [x] 6.3 Rendere generiche patch, conflitti e applicazione delle operazioni su tutte le collezioni della tab, blocchi di risorsa annidati inclusi; verificare con test di servizio che righe di collezioni differenti si uniscano e che una riga rimossa scompaia dal documento.
- [x] 6.4 Ricomporre la tab in una intestazione a piena larghezza con nome in evidenza allineato al riquadro di classe e in tre colonne di uguale larghezza: caratteristiche, ispirazione, bonus competenza, tiri salvezza, abilità, Percezione passiva, strumenti e linguaggi nella prima; Classe Armatura, iniziativa, velocità, punti ferita, dadi vita, tiri salvezza contro morte, attacchi, equipaggiamento e monete nella seconda; caratteristiche narrative, risorse e privilegi nella terza.
- [x] 6.5 Disegnare le monete CP, SP, GP e PP con forma e colore distinti del metallo corrispondente e presentare l'equipaggiamento come righe quantità, nome e peso con peso totale compilabile a mano.
- [x] 6.6 Rendere ogni privilegio una riga singola con nome, fonte selezionabile e descrizione, preceduta da un filtro di testo che restringe l'elenco senza modificare i dati.
- [x] 6.7 Eseguire suite automatica, type-check e build di produzione dopo la riorganizzazione; verificare che tutti i comandi terminino con successo.
- [x] 6.8 Riacquisire gli screenshot della tab a viewport desktop e stretto e rivedere proporzioni della finestra, densità delle tre colonne, leggibilità dei riquadri stretti delle caratteristiche e assenza di overflow orizzontale.
