## Decisione

Riutilizzare il markup e i valori della barra in `Token.tsx`. Nello stato normale le righe occupano pochi pixel e le etichette numeriche sono nascoste visivamente; `:hover` e `:focus-visible` sul token ripristinano le dimensioni e le etichette esistenti. Il token attivo sale sopra quelli adiacenti soltanto mentre è consultato. `pointer-events: none` sulla barra continua a lasciare l'interazione al token.

Nessun dato HP passa al client in più rispetto a oggi. Il nome accessibile del token continua a dichiarare i numeri esatti anche quando la barra è compatta.
