# Design

## Context

Gli elementi scenici P0.9c sono non-token. Il modello corrente supporta isInvisible e sanitizzazione parziale, mentre P0.10 definirà secrets/fog completi.

## Goals / Non-Goals

**Goals:** preparazione posizionale, separazione dagli elementi e visibilità coerente col modello corrente.

**Non-Goals:** fog server-side, nuovi livelli di segretezza, elementi scenici o persistenza delle mutazioni live.

## Decisions

### 1. Placement referenziale

Ogni placement riferisce encounter/entity, posizione e trasformazione iniziale con ID stabile.

Il placement usa `entityReferenceId` ed `encounterId` immutabili, coordinate intere non negative e override facoltativi `widthCells`/`heightCells`. `isHidden` controlla la visibilità dell'istanza. Gli ingombri nulli ereditano quelli della figura. La rotazione non appartiene al modello token corrente e non viene introdotta. Il normalizzatore verifica il footprint rispetto alle dimensioni della scena; i riferimenti legacy non-encounter restano compatibili.

### 2. Token runtime collegato

L'adapter materializza UnitToken e conserva il collegamento senza copiare le proprietà sceniche.

L'ID del placement è anche l'ID del token, senza aggiungere metadati privati al payload condiviso. Un registro server in memoria conserva l'ultima preparazione proiettata per scena: una riconciliazione pura applica soltanto aggiunte, rimozioni e proprietà iniziali cambiate. Una modifica di nome scena o drawing non ripristina posizione, HP, condizioni o token eliminati nel runtime. Le scene inattive sono riconciliate all'attivazione; il calcolo della preview di trasferimento tiene conto dei loro token preparati senza mutarle.

`SceneService.updateScene` accetta un validatore pre-scrittura per verificare la proiezione proposta contro il runtime della scena, inclusi collisioni e confini. Il registro avanza soltanto dopo la persistenza. Errori di validazione, concorrenza o SQLite non aggiornano la proiezione e non emettono broadcast. Le route placement sono Master-only, versionate e distinte dal CRUD delle figure.

L'editor riusa il contenitore trasformato della preview con un layer token separato dagli arredi. Il form consente collocazione, movimento e resize con coordinate mostrate da 1; il trascinamento usa la geometria del contenitore trasformato e invia una scrittura al termine. Drawing e pan sospendono gli handler placement; `Esc`/pointercancel scartano il gesto. La rimozione conserva la figura preparata.

### 3. Visibilità corrente

Hidden/prepared usa isInvisible o equivalente canonico; nessun nuovo claim di segretezza.

## Risks / Trade-offs

- [Placement e token divergono] → Adapter unico e link stabile.
- [Hidden interpretato come sicuro] → UI, spec e test dichiarano il confine P0.10.

## Dipendenze

Dipende da p0-9e-2-encounter-entities, p0-9e-3-monster-npc-data e dalle trasformazioni Board esistenti.
