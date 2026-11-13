## ADDED Requirements

### Requirement: Velo del buio nella vista Master

Quando il buio della scena attiva è abilitato, il sistema SHALL indicare nella vista Master il terreno sconosciuto al party con un velo nero semitrasparente al 45%, mantenendo leggibili la mappa e tutti i token che il Master può gestire. Il terreno esplorato SHALL rimanere scoperto. La luce completa SHALL rimuovere il velo. L'effetto SHALL funzionare nella board normale e fullscreen, senza intercettare puntamento, selezione o movimento. La vista Player SHALL mantenere nero pieno e opaco sul terreno sconosciuto e SHALL conservare le regole correnti di visibilità delle creature.

#### Scenario: Master e Player nella stessa scena

- **WHEN** il Master abilita il buio e Master e Player osservano un'area sconosciuta
- **THEN** il Master distingue ancora la mappa sotto il velo al 45%, mentre il Player vede nero opaco

#### Scenario: Terreno ricordato e creature

- **WHEN** il party si allontana da un'area esplorata
- **THEN** entrambi mantengono visibile il terreno ricordato, il Master mantiene i propri permessi sulle creature e il Player non ottiene visione corrente grazie alla memoria

#### Scenario: Luce completa e fullscreen

- **WHEN** si attiva la luce completa oppure si apre la stessa scena in fullscreen
- **THEN** la luce completa elimina il velo in entrambe le viste e fullscreen mantiene il comportamento del ruolo corrente
