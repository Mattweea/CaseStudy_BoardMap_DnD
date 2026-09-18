import type { ReactNode } from 'react';
import { CHARACTER_PROFILES } from '../constants/characters';
import type { DiceRollLog, DiceRollSourceRequest, DiceType } from '../types';
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

// Dettaglio del tiro (dado naturale più modificatore) mostrato solo al passaggio del mouse sul
// totale, via `title`: il totale resta l'unico numero sempre leggibile.
function breakdownTitle(rolls: number[], modifier: number) {
  return `${rolls.join('+')}${signed(modifier)}`;
}

interface DiceLogEntryProps {
  log: DiceRollLog;
  isExpanded: boolean;
  onToggle: () => void;
  onRoll?: (request: DiceRollSourceRequest) => void;
}

interface PairBox {
  value: number;
  title: string;
  highlight?: string;
}

// Forma comune a ogni bersaglio della scheda (uno o due riquadri col totale, mai la formula in
// chiaro, dettaglio solo in hover): un tiro singolo (dado vita, salvataggio contro morte), un
// tiro doppio (caratteristiche/prove/attacco) e un tiro di danno sono la stessa card, con un
// riquadro diverso per numero soltanto.
function PairCard({ header, boxes, partLabels, caption, savingThrow, visibility }: {
  header: ReactNode; boxes: PairBox[]; partLabels?: Array<string | undefined>;
  caption: ReactNode; savingThrow?: DiceRollLog['savingThrow']; visibility: 'public' | 'secret';
}) {
  return <article className="dice-log__entry dice-log__entry--dual">
    {header}
    <div className="dice-log__pair">
      {boxes.flatMap((box, index) => [
        index > 0 ? <span className="dice-log__pair-divider" aria-hidden="true" key={`div-${index}`} /> : null,
        <span key={index} className={`dice-log__pair-total ${box.highlight ?? ''}`} title={box.title}>{box.value}</span>,
      ])}
    </div>
    {partLabels && partLabels.length > 1 ? <div className="dice-log__pair-caption dice-log__pair-caption--parts">{partLabels.map((label, index) => <small key={index}>{label}</small>)}</div> : null}
    <div className="dice-log__pair-caption">{caption}</div>
    {savingThrow ? <p className="dice-log__saving-throw">Tiro salvezza: {savingThrow.ability ? abilityLabels[savingThrow.ability] ?? savingThrow.ability : '—'} CD {savingThrow.dc || '—'}</p> : null}
    {visibility === 'secret' ? <small>Segreto</small> : null}
  </article>;
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

export function DiceLogEntry({ log, isExpanded, onToggle, onRoll }: DiceLogEntryProps) {
  const profile = CHARACTER_PROFILES.find((entry) => entry.id === log.authorUserId);
  const timestamp = new Date(log.timestamp);
  const kind = sourceKind(log.source?.target);

  const header = <header>
    <img src={profile?.imageUrl} alt="" />
    <div><strong>{profile?.displayName ?? log.rollerName}</strong><span>{profile?.username ?? log.rollerName}</span></div>
    <time dateTime={log.timestamp}>{Number.isNaN(timestamp.valueOf()) ? '' : timestamp.toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</time>
  </header>;

  if (kind === 'dual') {
    const [naturalA, naturalB] = log.rolls;
    const totals = log.rolls.map((natural) => natural + log.modifier);
    const highlight = (natural: number) => natural === 20 ? 'dice-log__pair-total--crit' : natural === 1 ? 'dice-log__pair-total--fumble' : undefined;
    const canRollDamage = log.source?.target.startsWith('attack:') && Boolean(onRoll);
    const rollDamage = () => {
      if (!log.source || !onRoll) return;
      const attackId = log.source.target.slice('attack:'.length);
      onRoll({ source: { sheetId: log.source.sheetId, target: `attack-damage:${attackId}` }, critical: log.critical === true });
    };
    return <PairCard
      header={header} visibility={log.visibility} savingThrow={log.savingThrow}
      boxes={[
        { value: totals[0], title: breakdownTitle([naturalA], log.modifier), highlight: highlight(naturalA) },
        { value: totals[1], title: breakdownTitle([naturalB], log.modifier), highlight: highlight(naturalB) },
      ]}
      caption={canRollDamage
        ? <button type="button" className="dice-log__action-name" onClick={rollDamage}>{log.actionLabel ?? log.label}</button>
        : <span>{log.actionLabel ?? log.label}</span>}
    />;
  }

  if (kind === 'damage') {
    const rollParts = log.parts?.length ? log.parts : [{ label: undefined, rolls: log.rolls, modifier: log.modifier, total: log.total, critical: log.critical }];
    return <PairCard
      header={header} visibility={log.visibility}
      boxes={rollParts.map((part) => ({ value: part.total, title: breakdownTitle(part.rolls, part.modifier), highlight: part.critical ? 'dice-log__pair-total--crit' : undefined }))}
      partLabels={rollParts.length > 1 ? rollParts.map((part) => part.label) : undefined}
      caption={<span>{log.actionLabel ?? log.label}</span>}
    />;
  }

  if (kind === 'single') {
    return <PairCard
      header={header} visibility={log.visibility}
      boxes={[{ value: log.total, title: breakdownTitle(log.rolls, log.modifier) }]}
      caption={<span>{log.actionLabel ?? log.label}</span>}
    />;
  }

  // Tiro libero di P0.3: comportamento invariato, dado singolo con dettaglio pieghevole.
  const diceSides = diceSidesFromFormula(log.formula);
  const diceTotal = log.keptRolls.reduce((sum, roll) => sum + roll, 0);
  return <article className={`dice-log__entry ${isExpanded ? 'dice-log__entry--expanded' : ''}`}>
    {header}
    <p className="dice-log__formula">{log.formula}</p>
    {isExpanded ? <div className="dice-log__detail">
      <div className="dice-log__dice-row">{log.rolls.map((roll, index) => <span className="dice-log__die" key={`${log.id}-${index}`}><DiceGlyph type={numericDiceToIconType[diceSides]} /><b>{roll}</b></span>)}</div>
      <b className="dice-log__dice-total">{diceTotal}</b>
    </div> : null}
    <button type="button" className="dice-log__total" onClick={onToggle} aria-expanded={isExpanded} aria-label={`Mostra dettaglio di ${log.formula}`}>{log.total}</button>
    {log.visibility === 'secret' ? <small>Segreto</small> : null}
  </article>;
}
