# Tasks

## 0. Runtime per scena

- [x] 0.1 Separare i token live per scena durante il processo e installare il runtime corretto all'attivazione senza cambiare la persistenza della configurazione.
- [x] 0.2 Allineare login, snapshot, undo e commit live evitando duplicati e riferimenti fra scene; testare cambio/ritorno e riavvio.

## 1. Party e layout

- [x] 1.1 Implementare selezione server riusando roster, familiar e vehicle helper.
- [x] 1.2 Implementare layout deterministico da cella ancora rispettando footprint, limiti e ostacoli.
- [x] 1.3 Testare duplicati, riferimenti invalidi, bordi, spazio insufficiente e riproducibilità.

## 2. Preview e commit

- [x] 2.1 Implementare preview senza scrittura.
- [x] 2.2 Implementare pubblicazione atomica in memoria con controllo versioni, round e ricalcolo, senza persistere il runtime delle scene.
- [x] 2.3 Testare conflitto e failure injection prima della pubblicazione dimostrando rollback totale.
- [x] 2.4 Implementare preview e commit Master-only da scena attiva a destinazione inattiva selezionata, con attivazione persistita e singolo snapshot atomico.
- [x] 2.5 Testare attivazione combinata, permessi, conflitti, round, errore di persistenza, rollback e sincronizzazione Master/Player.

## 3. UI e verifica

- [x] 3.1 Implementare flusso Master accessibile di sorgente, ancora, preview e conferma.
- [x] 3.2 Verificare sincronizzazione con due Player e assenza controlli Player.
- [x] 3.3 Aggiornare Docs/ai, eseguire check/test/build e validare p0-9d-3-atomic-party-transfer strict.
- [x] 3.4 Sostituire il percorso principale della UI con «Attiva e trasferisci il party» dalla destinazione selezionata, mantenendo «Attiva scena» e la conferma dopo preview.
- [x] 3.5 Aggiornare i contratti Docs/ai, eseguire test/build/docs:check e validare il change strict dopo la revisione.
