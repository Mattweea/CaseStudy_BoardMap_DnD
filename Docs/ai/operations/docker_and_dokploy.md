# Docker e deploy su Dokploy

## Avvio e architettura

Il `Dockerfile` nella root costruisce una sola immagine. Lo stage di build usa Node 22 su Debian, installa le dipendenze e compila React/Vite. L'immagine finale contiene la build `dist`, Fastify e le dipendenze di produzione, senza strumenti di compilazione o server aggiuntivi.

All'avvio il container applica le migrazioni e, solo se riescono, esegue Fastify con `exec` per conservare la gestione dei segnali di arresto. Il processo gira come utente `node` e serve frontend, API e SSE sulla porta `3001`. L'healthcheck interroga `/api/health`.

Fastify serve solo i file pubblici presenti in `dist` tramite `@fastify/static`. In assenza della build resta disponibile il backend usato nello sviluppo con Vite. Le API mantengono autorizzazione e risposte di errore; i file inesistenti ricevono `404`. Il browser usa `/api` e `/api/battle-map/stream` sullo stesso dominio, impostati nella build Docker.

La `.dockerignore` esclude dipendenze locali, database, upload, snapshot e configurazioni locali dal contesto di build.

## Configurazione Dokploy

1. Crea una **Application** dal repository e seleziona **Build Type: Dockerfile**.
2. Imposta **Dockerfile Path** su `Dockerfile`, **Docker Context Path** su `.` e lascia **Docker Build Stage** vuoto per usare l'immagine finale.
3. Aggiungi un named volume con mount path **`/app/server/data`** per conservare tutti i dati runtime.
4. Collega il dominio alla porta container **`3001`** e abilita HTTPS. I cookie di sessione sono `Secure` in produzione.
5. Mantieni **una sola replica**, sullo stesso host del volume. Avvia il deploy e verifica `/`, `/api/health`, login e sincronizzazione fra Master e Adventurer.

Dokploy gestisce dominio, certificato e routing tramite Traefik. Non servono configurazioni aggiuntive di proxy nell'applicazione.

Il Dockerfile configura già `NODE_ENV=production`, `HOST=0.0.0.0`, `PORT=3001` e `VTT_DB_PATH=/app/server/data/database.sqlite`. Non sono necessarie altre variabili per il normale deploy sullo stesso dominio. Se cambi `PORT`, aggiorna la porta del dominio. Se cambi `VTT_DB_PATH`, assicurati che il nuovo percorso sia ancora coperto da un volume. `CORS_ORIGINS` rimane disponibile per ammettere origini aggiuntive esatte.

I profili iniziali mantengono le credenziali del roster documentate nel README. La dockerizzazione non aggiunge una configurazione password; l'accesso al dominio deve restare limitato ai partecipanti autorizzati finché le credenziali restano condivise.

Riferimenti ufficiali: [build Dockerfile](https://docs.dokploy.com/docs/core/applications/build-type), [configurazione applicazioni e volumi](https://docs.dokploy.com/docs/core/applications/advanced).

## Persistenza e aggiornamenti

Il singolo volume `/app/server/data` contiene SQLite con i suoi file WAL/SHM, ritratti, sfondi e `last-session.json`. Codice e migrazioni restano fuori dal volume, in `/app/database`. I named volume nuovi ereditano i permessi della directory dell'immagine; i dati importati devono essere scrivibili da UID/GID `1000:1000`.

Prima di un redeploy, il Master sospende la partita per salvare lo snapshot. Il riavvio termina le sessioni di login e non recupera automaticamente lo stato live o i token delle scene inattive; dopo il login il Master riprende esplicitamente lo snapshot.

Prima di aggiornamenti con nuove migrazioni, sospendi la partita, ferma l'applicazione e prepara un backup coerente dell'intero volume. Configura un tempo di arresto di 30 secondi per consentire il flush delle schede. Per ripristinare una versione con schema incompatibile serve anche il relativo backup dei dati. Evita `db:fresh` sui dati da conservare.

I dati di sviluppo non vengono incorporati nell'immagine. Per importarli, ferma il backend sorgente e copia nel volume il contenuto di `server/data/` e il database sorgente, con eventuali WAL/SHM, usando i nomi `database.sqlite`, `database.sqlite-wal` e `database.sqlite-shm`. Ripristina a container fermo e verifica i permessi prima dell'avvio.

## Prova locale

```bash
docker build -t dnd-battle-map .
docker run --name dnd-battle-map --stop-timeout 30 -p 127.0.0.1:3001:3001 -e NODE_ENV=development --mount type=volume,source=dnd-battle-map-data,target=/app/server/data dnd-battle-map
```

Apri `http://localhost:3001`. L'override `NODE_ENV=development` consente il cookie su HTTP locale; su Dokploy mantieni il valore di produzione e HTTPS. Rimuovere e ricreare il container mantenendo lo stesso named volume conserva i dati già persistiti.
