# Design

## Context

Token, roster, familiari e veicoli possiedono già relazioni e helper. Il server è autorevole per collisioni e movimento. Oggi `battleMapState.tokens` è globale e l'attivazione conserva gli stessi token; SQLite salva la configurazione della scena, non `runtime.tokens`. Il trasferimento richiede prima un proprietario live distinto per scena.

## Goals / Non-Goals

**Goals:** runtime token distinto per scena durante il processo, selezione canonica del party, layout riproducibile, scelta esplicita della destinazione e attivazione con trasferimento tutto-o-niente.

**Non-Goals:** teletrasporto automatico a ogni switch, trasferimento di nemici o recupero persistente del runtime completo dopo riavvio.

## Decisions

### 1. Proprietà del runtime live

Una mappa server in memoria conserva i token delle scene inattive. `battleMapState.tokens` resta la proiezione mutabile autorevole della sola scena attiva: l'attivazione salva la scena uscente nella mappa e installa quella entrante in un unico passaggio prima del broadcast. La prima scena eredita il runtime corrente per compatibilità; le altre iniziano vuote. Il cambio continua a rispettare il divieto durante round attivo e azzera i riferimenti a token della scena uscente, oltre al tracker in roll phase. Login, ripristino snapshot e undo non devono reintrodurre token di una scena diversa o duplicare un token canonico presente altrove. Le copie inattive non sono scritte in SQLite né recuperate automaticamente dopo riavvio.

### 2. Party calcolato dal server

Il client non invia una lista arbitraria; il server deriva membri e relazioni dai modelli correnti.

### 3. Destinazione selezionata e preview non mutante

La scena selezionata nel catalogo è la destinazione inattiva; la sorgente è sempre la scena attiva. Il Master mantiene due azioni distinte: attivazione semplice e attivazione con trasferimento. La seconda calcola prima una preview dei footprint liberi nella destinazione, senza prenotare, scrivere né cambiare la scena attiva. La UI nomina esplicitamente sorgente e destinazione e richiede conferma dopo la preview.

### 4. Commit combinato con ricalcolo

Alla conferma il server rivalida versioni della sorgente, della destinazione e dello stato live, round e spazio contro i runtime più recenti. Prepara copie complete dei token rimasti nella sorgente e della nuova proiezione attiva della destinazione, normalizza e valida entrambe. Soltanto allora persiste il cambio della scena attiva in SQLite; un errore di persistenza lascia runtime e identità invariati. Dopo la scrittura, installa in modo sincrono le copie già preparate e pubblica un solo incremento di versione e un solo broadcast. Nessuna scrittura SQLite del runtime è prevista. Un errore prima della pubblicazione non può cambiare né la scena attiva né i token. Il trasferimento non entra negli stack undo che potrebbero ripristinarne solo una metà.

La route Master-only per l'operazione combinata riusa il planner del party e la verifica di versione dell'attivazione ordinaria. La vecchia route di trasferimento verso la scena già attiva resta compatibile ma non guida più il percorso principale della UI. Il client non invia token arbitrari e non effettua due mutazioni sequenziali.

## Risks / Trade-offs

- [Relazioni spezzate] → Test su familiari, occupanti e ID preservati.
- [Preview stale] → Ricalcolo obbligatorio al commit.
- [Scrittura parziale] → Preparazione e validazione complete prima di pubblicare i due runtime.
- [Attivazione riuscita ma trasferimento fallito] → Un solo commit server: validazione prima della scrittura SQLite e nessun passaggio applicativo fallibile tra persistenza e installazione del runtime preparato; test di failure injection e di errore repository.
- [Token duplicato dal login] → Ricerca del token canonico in tutte le scene live prima dello spawn.

## Dipendenze

Dipende da p0-9a-2-scene-persistence, p0-9d-1-realtime-scene-transition e dalle capability canoniche di token/veicoli.
