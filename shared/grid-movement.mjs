// Costo di percorso su griglia condiviso fra server e client: stessa aritmetica, nessuna build
// richiesta per essere importato sia da Node (server/) sia da Vite (src/). Vedi shared/dnd-rules.mjs
// per il precedente di questo pattern.

function normalizeParity(diagonalParity) {
  return diagonalParity === 1 ? 1 : 0;
}

// Decompone un segmento in passi di una casella nelle otto direzioni adiacenti: prima i passi
// diagonali necessari a coprire la differenza minore fra i due assi, poi i passi ortogonali
// residui lungo l'asse più lungo. Restituisce le posizioni intermedie, dalla prima dopo `from`
// fino a `to` incluso; un `from` uguale a `to` restituisce un array vuoto.
export function decomposeSegment(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const stepX = Math.sign(dx);
  const stepY = Math.sign(dy);
  const diagonalCount = Math.min(Math.abs(dx), Math.abs(dy));
  const orthogonalCount = Math.max(Math.abs(dx), Math.abs(dy)) - diagonalCount;
  const orthogonalStepX = Math.abs(dx) > Math.abs(dy) ? stepX : 0;
  const orthogonalStepY = Math.abs(dy) > Math.abs(dx) ? stepY : 0;

  const steps = [];
  let x = from.x;
  let y = from.y;

  for (let index = 0; index < diagonalCount; index += 1) {
    x += stepX;
    y += stepY;
    steps.push({ x, y, diagonal: true });
  }

  for (let index = 0; index < orthogonalCount; index += 1) {
    x += orthogonalStepX;
    y += orthogonalStepY;
    steps.push({ x, y, diagonal: false });
  }

  return steps;
}

// Costo di un percorso di uno o più segmenti (waypoint consecutivi), data la regola delle
// diagonali e l'alternanza da cui riprendere il conteggio. `standard` addebita una casella per
// ogni passo, diagonale o meno; `alternating` (variante 5-10-5) addebita una casella al primo
// passo diagonale del turno, due al secondo, e così via, riprendendo da `diagonalParity` invece
// di ricominciare da zero. Un percorso vuoto o di un solo punto costa zero.
//
// `stepCostMultiplier` (predefinito 1, P0.8c) moltiplica il costo di ogni singolo passo dopo
// l'alternanza diagonale, per il costo raddoppiato di chi si muove strisciando da prono. Il
// parametro è opzionale e il default non cambia il risultato per nessun chiamante esistente.
export function pathCost(waypoints, { rule = 'standard', diagonalParity = 0, stepCostMultiplier = 1 } = {}) {
  let parity = normalizeParity(diagonalParity);
  const multiplier =
    typeof stepCostMultiplier === 'number' && Number.isFinite(stepCostMultiplier) && stepCostMultiplier > 0
      ? stepCostMultiplier
      : 1;

  if (!Array.isArray(waypoints) || waypoints.length < 2) {
    return { cells: 0, steps: [], nextDiagonalParity: parity };
  }

  let cells = 0;
  const steps = [];

  for (let index = 0; index < waypoints.length - 1; index += 1) {
    const segmentSteps = decomposeSegment(waypoints[index], waypoints[index + 1]);

    for (const step of segmentSteps) {
      let cost = 1;
      if (step.diagonal && rule === 'alternating') {
        cost = parity === 0 ? 1 : 2;
        parity = parity === 0 ? 1 : 0;
      }
      cost *= multiplier;

      cells += cost;
      steps.push({ x: step.x, y: step.y, diagonal: step.diagonal, cost });
    }
  }

  return { cells, steps, nextDiagonalParity: parity };
}

export function isValidCellsValue(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

// Converte un numero di caselle nell'unità della partita; un valore per casella non valido
// respinge la conversione restituendo null invece di produrre un numero fuorviante.
export function cellsToUnit(cells, cellsValue) {
  if (!isValidCellsValue(cellsValue) || typeof cells !== 'number' || !Number.isFinite(cells)) {
    return null;
  }

  return cells * cellsValue;
}
