export function validateRollName(value) {
  if (value === undefined) return {};
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    [...value.trim()].length > 120 ||
    /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    return { error: 'Il nome del tiro deve contenere da 1 a 120 caratteri, senza caratteri di controllo.' };
  }
  return { name: value.trim() };
}

export function parseDiceCommand(value) {
  const command = value.trim().match(/^\/(r|rs)\s+([\s\S]+)$/i);
  if (!command) return { error: 'Usa /r FORMULA o /rs FORMULA, eventualmente seguito da -n "nome".' };
  const body = command[2];
  const option = /\s+-n(?:\s|$)/.exec(body);
  let formula = body,
    name;
  if (option) {
    formula = body.slice(0, option.index).trim();
    const suffix = body.slice(option.index).trim();
    const match = suffix.match(/^-n\s+("(?:[^"\\\u0000-\u001f]|\\["\\])*")\s*$/u);
    if (!match) return { error: 'Usa una sola opzione finale -n "nome"; ammesse escape di virgolette e backslash.' };
    const checked = validateRollName(JSON.parse(match[1]));
    if (checked.error) return checked;
    name = checked.name;
  }
  if (!formula || /["\\]/.test(formula)) return { error: 'Formula non valida.' };
  return {
    request: {
      formula,
      visibility: command[1].toLowerCase() === 'rs' ? 'secret' : 'public',
      ...(name === undefined ? {} : { name }),
    },
  };
}
