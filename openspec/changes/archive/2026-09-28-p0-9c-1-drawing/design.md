# Design

## Context

Board usa SVG/DOM e coordinate a celle. La preview del dialog Preparazione scena dispone già di immagine calibrata, griglia e confine. Il documento P0.9a prevede layer separati e il progetto serializza mutazioni autorevoli.

## Goals / Non-Goals

**Goals:** tratti persistenti preparati nel dialog, gomma selettiva, bozza locale e proiezione realtime della sola scena attiva.

**Non-Goals:** editor vettoriale completo, forme avanzate, elementi scenici o undo/redo.

## Decisions

### 1. Polilinee a celle

Ogni tratto ha ID, punti, colore e spessore in coordinate logiche indipendenti dalla viewport.
I punti sono coordinate di cella frazionarie e non negative; colore esadecimale a sei cifre e
spessore in celle hanno limiti espliciti. I documenti precedenti senza stile ricevono valori
predefiniti. Il numero di tratti, punti e byte resta limitato dal normalizzatore condiviso.

### 2. Un commit per gesto

Il client campiona la bozza localmente e invia il tratto al pointer-up; la gomma invia gli ID intersecati. Le richieste usano ID e versione del dettaglio della scena selezionata, non della scena attiva della board. Una risposta aggiorna catalogo e dettaglio; un conflitto ricarica la scena corrente e segnala il rifiuto.

### 3. Layer separato

La gomma può rimuovere solo drawing e non elementi o token sovrapposti. Matita, gomma e impostazioni vivono nella preview del dialog; la Board conserva soltanto il layer di visualizzazione.
Il raggio della gomma è costante in celle logiche: lo stesso valore governa intersezione e
cerchio di anteprima, trasformati entrambi con la scala della preview. La cattura del puntatore è confinata alla preview e non copre i controlli del dialog.

### 4. Controlli del pennello

Lo spessore è un range verticale nativo nel dialog, così trascinamento, frecce e accessibilità restano
coerenti; dimensione del pallino e preview seguono il valore in celle della matita. Il colore
è un campione circolare nello stile del dialog con picker personalizzato.
Questi controlli modificano solo il draft locale del Master, non la scena finché non disegna.

### 5. Coerenza della preparazione

L'editor consente di disegnare sia sulla scena attiva sia su una scena inattiva. Un aggiornamento della prima viene proiettato subito sulla board condivisa; una modifica della seconda rimane nel catalogo Master senza broadcast. Se nome, sfondo, calibrazione o dimensioni hanno modifiche non salvate, gli strumenti drawing attendono il salvataggio o l'annullamento di tali modifiche per non usare coordinate diverse dalla configurazione persistita.

## Risks / Trade-offs

- [Payload grande] → Semplificazione punti e limiti server.
- [Disallineamento dalla preview] → Coordinate derivate dalla stessa scala e origine della griglia di preparazione; bozze di calibrazione o dimensioni bloccano temporaneamente il disegno.

## Dipendenze

Dipende da p0-9a-1-scene-model, p0-9a-2-scene-persistence e p0-9a-4-active-scene.
