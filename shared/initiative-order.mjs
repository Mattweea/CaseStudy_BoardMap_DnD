// Regole d'ordine del tracker d'iniziativa (P0.8a), condivise da server e test.
//
// L'ordine autorevole è l'array delle voci così com'è: questo modulo non lo riordina mai per
// intero, perché uno spostamento esplicito del Master deve sopravvivere a ogni inserimento
// successivo. Una voce nuova si inserisce davanti alla prima voce esistente che la segue secondo
// `compareInitiative`; se non ce n'è nessuna va in coda.

function numberOr(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

// Negativo quando `a` viene prima di `b`: valore più alto, poi Destrezza più alta, poi frazione
// di spareggio più alta. Una frazione assente (voce vista da un client) vale 0.
export function compareInitiative(a, b) {
  const byValue = numberOr(b?.value, 0) - numberOr(a?.value, 0);
  if (byValue !== 0) return byValue;
  const byDex = numberOr(b?.dexModifier, 0) - numberOr(a?.dexModifier, 0);
  if (byDex !== 0) return byDex;
  return numberOr(b?.tiebreaker, 0) - numberOr(a?.tiebreaker, 0);
}

// Inserisce `entry` senza toccare la posizione relativa delle altre voci. Una voce già presente
// per lo stesso token viene prima rimossa: sostituire equivale a rimuovere e reinserire.
export function insertInitiativeEntry(entries, entry) {
  const others = entries.filter((current) => current.tokenId !== entry.tokenId);
  const index = others.findIndex((current) => compareInitiative(entry, current) < 0);
  if (index < 0) return [...others, entry];
  return [...others.slice(0, index), entry, ...others.slice(index)];
}
