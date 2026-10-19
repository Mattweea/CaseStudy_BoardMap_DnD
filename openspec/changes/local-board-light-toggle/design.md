## Decisione

Il pulsante legge `isBoardFullyLit` dalla proiezione della scena attiva e mostra luna quando il buio è attivo, sole quando la scena è illuminata. App invia `isFullyLit` alla PATCH versionata della scena identificata da `activeSceneId` e `activeSceneVersion`; il server persiste il documento e diffonde la nuova proiezione. L’icona cambia solo dopo il broadcast. Durante la richiesta il pulsante è disabilitato; un conflitto o errore mostra feedback e conserva lo stato confermato. Le scene inattive non cambiano.

Il controllo appare accanto allo zoom nelle viste normale e fullscreen solo al Master. La board del Master resta visibile per la gestione; il toggle governa la visibilità dei Player.
