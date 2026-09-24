import type { ReactNode } from 'react';
import { CHARACTER_PROFILES, resolveCharacterPortrait } from '../constants/characters';
import type { DiceRollLog, DiceRollSourceRequest, DiceType } from '../types';
import type { CharacterSheetRosterEntry } from '../utils/characterSheetApi';
import { DiceGlyph, numericDiceToIconType } from './DiceIcons';

function diceSidesFromFormula(formula: string): DiceType {
  const sides = Number(formula.match(/d(4|6|8|10|12|20|100)/i)?.[1] ?? 20);
  return [4, 6, 8, 10, 12, 20, 100].includes(sides) ? sides as DiceType : 20;
}

const abilityLabels: Record<string, string> = {
  strength: 'Forza', dexterity: 'Destrezza', constitution: 'Costituzione',
  intelligence: 'Intelligenza', wisdom: 'Saggezza', charisma: 'Carisma',
};

function signed(value: number) {
  return value === 0 ? '' : value > 0 ? `+${value}` : `${value}`;
}

interface ResultBox {
  value: number;
  highlight?: 'crit' | 'fumble';
}

interface DetailGroup {
  key: string;
  label?: string;
  sides: DiceType;
  rolls: number[];
  modifier: number;
  // Presente solo quando i dadi del gruppo si sommano in un unico subtotale (danno, tiro
  // singolo, gruppo del tiro libero). Un bersaglio 1d20 o un Xd20 indipendente non lo porta:
  // i suoi dadi sono esiti alternativi, non addendi, e sommarli mentirebbe sul loro significato.
  total?: number;
}

interface CardModel {
  results: ResultBox[];
  formula: string;
  detailGroups: DetailGroup[];
  caption: ReactNode | null;
  savingThrow?: DiceRollLog['savingThrow'];
}

// Un bersaglio della scheda (P0.5 Fase B) porta `log.source`: distingue le forme di voce. Il dado
// vita e i salvataggi contro morte restano un tiro singolo: nessuno dei due ha nozione di
// vantaggio/svantaggio in 5e, a differenza degli altri bersagli `1d20`.
function sourceKind(target: string | undefined): 'single' | 'damage' | 'dual' | 'free' {
  if (!target) return 'free';
  if (target === 'hit-dice' || target === 'death-saves') return 'single';
  if (target.startsWith('attack-damage:')) return 'damage';
  return 'dual';
}

function highlightFor(natural: number): 'crit' | 'fumble' | undefined {
  return natural === 20 ? 'crit' : natural === 1 ? 'fumble' : undefined;
}

function buildModel(log: DiceRollLog, onRoll?: (request: DiceRollSourceRequest) => void): CardModel {
  const kind = sourceKind(log.source?.target);

  if (kind === 'dual') {
    const [naturalA, naturalB] = log.rolls;
    const canRollDamage = log.source?.target.startsWith('attack:') && Boolean(onRoll);
    const rollDamage = () => {
      if (!log.source || !onRoll) return;
      const attackId = log.source.target.slice('attack:'.length);
      onRoll({ source: { sheetId: log.source.sheetId, target: `attack-damage:${attackId}` }, critical: log.critical === true });
    };
    return {
      formula: log.formula,
      results: [
        { value: naturalA + log.modifier, highlight: highlightFor(naturalA) },
        { value: naturalB + log.modifier, highlight: highlightFor(naturalB) },
      ],
      detailGroups: [{ key: 'dual', sides: 20, rolls: log.rolls, modifier: log.modifier }],
      caption: canRollDamage
        ? <button type="button" className="dice-log__action-name" onClick={rollDamage}>{log.actionLabel ?? log.label}</button>
        : <span>{log.actionLabel ?? log.label}</span>,
      savingThrow: log.savingThrow,
    };
  }

  if (kind === 'damage') {
    const rollParts = log.parts?.length ? log.parts : [{ label: undefined, formula: log.formula, rolls: log.rolls, keptRolls: log.keptRolls, modifier: log.modifier, total: log.total, critical: log.critical }];
    return {
      formula: rollParts.map((part) => part.formula).join('+'),
      results: rollParts.map((part) => ({ value: part.total, highlight: part.critical ? 'crit' : undefined })),
      detailGroups: rollParts.map((part, index) => ({
        key: `part-${index}`, label: part.label, sides: diceSidesFromFormula(part.formula),
        rolls: part.rolls, modifier: part.modifier, total: part.total,
      })),
      caption: <span>{log.actionLabel ?? log.label}</span>,
    };
  }

  if (kind === 'single') {
    return {
      formula: log.formula,
      results: [{ value: log.total }],
      detailGroups: [{ key: 'single', sides: diceSidesFromFormula(log.formula), rolls: log.rolls, modifier: log.modifier, total: log.total }],
      caption: <span>{log.actionLabel ?? log.label}</span>,
    };
  }

  // Tiro libero di P0.3, ora estendibile a più gruppi. Un d20 solitario resta la coppia non
  // risolta (`unresolved`): i due valori restano indipendenti, mai sommati. Un Xd20 (X>1) o un
  // tiro non-d20 con più gruppi produce invece un totale aggregato con dettaglio per gruppo.
  if (log.parts?.length) {
    return {
      formula: log.formula,
      results: [{ value: log.total }],
      detailGroups: log.parts.map((part, index) => ({
        key: `free-part-${index}`, label: part.label, sides: diceSidesFromFormula(part.formula),
        rolls: part.rolls, modifier: part.modifier, total: part.total,
      })),
      caption: null,
    };
  }

  const isPureD20Roll = (log.dice?.length ?? 0) >= 2 && log.dice!.every((die) => die.sides === 20);
  if (isPureD20Roll) {
    return {
      formula: log.formula,
      results: log.rolls.map((natural) => ({ value: natural + log.modifier, highlight: highlightFor(natural) })),
      detailGroups: [{ key: 'd20', sides: 20, rolls: log.rolls, modifier: log.modifier }],
      caption: null,
    };
  }

  const diceSides = diceSidesFromFormula(log.formula);
  return {
    formula: log.formula,
    results: [{ value: log.total }],
    detailGroups: [{ key: 'free', sides: diceSides, rolls: log.rolls, modifier: log.modifier, total: log.total }],
    caption: null,
  };
}

interface DiceLogEntryProps {
  log: DiceRollLog;
  characterSheets: CharacterSheetRosterEntry[];
  isExpanded: boolean;
  onToggle: () => void;
  onRoll?: (request: DiceRollSourceRequest) => void;
}

export function DiceLogEntry({ log, characterSheets, isExpanded, onToggle, onRoll }: DiceLogEntryProps) {
  const profile = CHARACTER_PROFILES.find((entry) => entry.id === log.authorUserId);
  const sheet = characterSheets.find((entry) => entry.ownerUserId === log.authorUserId);
  const timestamp = new Date(log.timestamp);
  const model = buildModel(log, onRoll);

  return <article className={`dice-log__entry ${isExpanded ? 'dice-log__entry--expanded' : ''}`}>
    <header>
      <img src={resolveCharacterPortrait(profile, sheet?.portraitUrl)} alt="" />
      <div><strong>{profile?.displayName ?? log.rollerName}</strong><span>{profile?.username ?? log.rollerName}</span></div>
      <time dateTime={log.timestamp}>{Number.isNaN(timestamp.valueOf()) ? '' : timestamp.toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</time>
    </header>
    <p className="dice-log__formula">{model.formula}{log.visibility === 'secret' ? <em className="dice-log__secret-tag"> (segreto)</em> : null}</p>
    <div className="dice-log__pair">
      {model.results.flatMap((box, index) => [
        index > 0 ? <span className="dice-log__pair-divider" aria-hidden="true" key={`div-${index}`} /> : null,
        <button
          type="button" key={index} onClick={onToggle} aria-expanded={isExpanded}
          aria-label={`Mostra dettaglio di ${model.formula}`}
          className={`dice-log__pair-total ${box.highlight === 'crit' ? 'dice-log__pair-total--crit' : box.highlight === 'fumble' ? 'dice-log__pair-total--fumble' : ''}`}
        >{box.value}</button>,
      ])}
    </div>
    {isExpanded ? <div className="dice-log__detail">
      {model.detailGroups.map((group) => <div className="dice-log__detail-group" key={group.key}>
        {group.label ? <p className="dice-log__detail-label">{group.label}</p> : null}
        <div className="dice-log__dice-row">{group.rolls.map((roll, index) => <span className="dice-log__die" key={`${group.key}-${index}`}><DiceGlyph type={numericDiceToIconType[group.sides]} /><b>{roll}</b></span>)}</div>
        {group.total !== undefined ? <p className="dice-log__detail-subtotal">Subtotale dadi: {group.total - group.modifier}{group.modifier !== 0 ? ` · Modificatore: ${signed(group.modifier)}` : ''}</p> : null}
      </div>)}
    </div> : null}
    {model.caption ? <div className="dice-log__pair-caption">{model.caption}</div> : null}
    {model.savingThrow ? <p className="dice-log__saving-throw">Tiro salvezza: {model.savingThrow.ability ? abilityLabels[model.savingThrow.ability] ?? model.savingThrow.ability : '—'} CD {model.savingThrow.dc || '—'}</p> : null}
  </article>;
}
