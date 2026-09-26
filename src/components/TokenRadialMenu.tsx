import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';
import type { TokenCondition, UnitToken } from '../types';
import {
  CONDITION_ACCESS_KEYS,
  FREQUENT_CREATURE_CONDITIONS,
  conditionLabel,
  tokenConditionOptions,
} from '../utils/tokens';
import { ConditionBadge, ExhaustionIcon } from './ConditionBadge';

export interface TokenRadialMenuProps {
  token: UnitToken;
  // Centro del token in pixel schermo (già scalato per lo zoom e traslato per la camera): il menu
  // si ancora lì, come richiede la capability (design, decisione 6).
  screenPosition: { x: number; y: number };
  // Metà del lato maggiore del token in pixel schermo: il pannello «+» si apre oltre questo
  // raggio, così non copre il token.
  tokenRadius?: number;
  onClose: () => void;
  onToggleCondition: (condition: TokenCondition) => void;
  onSetExhaustion: (level: number) => void;
  onStandUp: () => void;
  // Scatto resta visibile sul proprio token; si attiva solo nel proprio turno a round avviato.
  showDash?: boolean;
  canDash?: boolean;
  dashUsed?: boolean;
  dashUnavailableReason?: string;
  onDash?: () => void;
  // Aure (P0.8d): accensione/spegnimento delle aure del personaggio, proprietario o Master.
  onToggleAura?: (auraId: string, active: boolean) => void;
}

type MenuEntry =
  | { kind: 'condition'; condition: TokenCondition }
  | { kind: 'stand-up' }
  | { kind: 'more' }
  | { kind: 'dash' }
  | { kind: 'auras' }
  | { kind: 'back' }
  | { kind: 'exhaustion-down' }
  | { kind: 'exhaustion-up' }
  | { kind: 'aura-toggle'; auraId: string };

const MIN_EXHAUSTION = 0;
const MAX_EXHAUSTION = 6;
// Tasto d'accesso di «Alzati»: la L di «aLzati», libera tra le lettere delle condizioni.
const STAND_UP_ACCESS_KEY = 'L';
// Tasto d'accesso di «Aure»: la U di aUre, libera tra le lettere delle condizioni e di «Alzati».
const AURAS_ACCESS_KEY = 'U';

// Raggio minimo della corona (px a schermo) e distanza minima tra il bordo del token e il centro
// delle voci: sui token grandi o con lo zoom alto la corona si allarga invece di coprire il token.
// Due archi attorno al token: stati a destra, azioni a sinistra. Il raggio lascia spazio anche
// alle pillole delle azioni senza coprire il token quando questo viene ingrandito.
const MIN_RING_RADIUS = 92;
const RING_CLEARANCE = 52;
const RING_ITEM_SIZE = 44;
const LABEL_GAP = 38;
// Distanza minima dal bordo dell'area visibile e dal token per corona e pannello.
const EDGE_MARGIN = 8;
const PANEL_GAP = 12;

// Le condizioni occupano l'arco destro, dall'alto al basso. Il comando «Altre» prosegue lo stesso
// arco; le azioni occupano quello sinistro, con una spaziatura che dipende dal loro numero.
function ringOffset(index: number, count: number, radius: number, side: 'status' | 'action'): { x: number; y: number } {
  const spread = side === 'status' ? Math.PI * (count >= 5 ? 0.88 : 0.72) : Math.PI * 0.42;
  const angle = side === 'status'
    ? -spread / 2 + (count === 1 ? 0.5 : index / (count - 1)) * spread
    : Math.PI + spread / 2 - (count === 1 ? 0.5 : index / (count - 1)) * spread;
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
}

// Etichetta con il tasto d'accesso sottolineato alla sua prima occorrenza (senza distinzione di
// maiuscole): il tasto è scelto in modo da comparire sempre nel nome italiano.
function AccessKeyLabel({ label, accessKey }: { label: string; accessKey: string }) {
  const index = label.toUpperCase().indexOf(accessKey);
  if (index < 0) {
    return <>{label}</>;
  }
  return (
    <>
      {label.slice(0, index)}
      <span className="token-radial-menu__access-key">{label.charAt(index)}</span>
      {label.slice(index + 1)}
    </>
  );
}

function CheckPip() {
  return (
    <span className="token-radial-menu__pip" aria-hidden="true">
      <svg viewBox="0 0 12 12">
        <path d="M2.5 6.3 5 8.6l4.5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function StrokeIcon({ children }: { children: ReactNode }) {
  return (
    <svg className="token-radial-menu__glyph" viewBox="0 0 16 16" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </g>
    </svg>
  );
}

export function TokenRadialMenu({
  token,
  screenPosition,
  tokenRadius = 0,
  onClose,
  onToggleCondition,
  onSetExhaustion,
  onStandUp,
  showDash = false,
  canDash = false,
  dashUsed = false,
  dashUnavailableReason = 'disponibile nel tuo turno',
  onDash,
  onToggleAura,
}: TokenRadialMenuProps) {
  // `null` = corona, `'more'` = pannello delle altre condizioni, `'auras'` = pannello delle aure.
  const [openPanel, setOpenPanel] = useState<'more' | 'auras' | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [focusIndex, setFocusIndex] = useState(0);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  // Il fuoco iniziale sulla prima voce serve alla tastiera ma non è una scelta dell'utente:
  // l'etichetta segue il fuoco solo dopo una navigazione da tastiera, altrimenti solo il puntatore.
  const [keyboardNavigated, setKeyboardNavigated] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  // Spostamento minimo che tiene corona e pannello dentro lo stage, e lato del pannello «+».
  const [shift, setShift] = useState({ x: 0, y: 0 });
  const [panelSide, setPanelSide] = useState<'right' | 'left'>('right');

  const isVehicle = token.type === 'vehicle';
  const catalog = tokenConditionOptions(token);
  const frequent = isVehicle ? catalog : FREQUENT_CREATURE_CONDITIONS.filter((condition) => catalog.includes(condition));
  const rest = catalog.filter((condition) => !frequent.includes(condition));
  const isProne = !isVehicle && token.conditions.includes('prone');
  const exhaustionLevel = token.exhaustionLevel ?? 0;
  const ringRadius = Math.max(MIN_RING_RADIUS, Math.round(tokenRadius + RING_CLEARANCE));
  // «Aure» compare solo sul token canonico di un personaggio (non un famiglio) con almeno un'aura
  // nella scheda; chi arriva qui può già aprire il menu, quindi è proprietario o Master (design,
  // decisione 8).
  const tokenAuras = token.auras ?? [];
  const canShowAuras = token.type === 'player' && token.isFamiliar !== true && Boolean(token.ownerUserId) && tokenAuras.length > 0;

  // Prono resta un interruttore anche sul token prono: toglierlo senza costo serve quando un'altra
  // creatura aiuta a rialzarsi o per decisione del Master. «Alzati» è l'azione con il costo di
  // movimento, nell'arco sinistro accanto a «Scatto» e «Aure».
  const ringEntries: MenuEntry[] = frequent.map((condition) => ({ kind: 'condition', condition }));
  const extraEntries: MenuEntry[] = [
    ...(!isVehicle && rest.length > 0 ? [{ kind: 'more' } as MenuEntry] : []),
    ...(isProne ? [{ kind: 'stand-up' } as MenuEntry] : []),
    ...(showDash ? [{ kind: 'dash' } as MenuEntry] : []),
    ...(canShowAuras ? [{ kind: 'auras' } as MenuEntry] : []),
  ];
  const statusCount = ringEntries.length + (extraEntries.some((entry) => entry.kind === 'more') ? 1 : 0);
  const actionCount = extraEntries.filter((entry) => entry.kind !== 'more').length;
  const mainEntries = [...ringEntries, ...extraEntries];
  const dashStatus = dashUsed ? 'già usato' : canDash ? null : dashUnavailableReason;
  const panelEntries: MenuEntry[] = [
    { kind: 'back' },
    ...rest.map((condition) => ({ kind: 'condition', condition }) as MenuEntry),
    { kind: 'exhaustion-down' },
    { kind: 'exhaustion-up' },
  ];
  const auraPanelEntries: MenuEntry[] = [
    { kind: 'back' },
    ...tokenAuras.map((aura) => ({ kind: 'aura-toggle', auraId: aura.id }) as MenuEntry),
  ];
  const activeEntries = openPanel === 'more' ? panelEntries : openPanel === 'auras' ? auraPanelEntries : mainEntries;
  // Nel pannello il fuoco parte dalla prima voce, non da «Indietro».
  const initialFocusIndex = openPanel ? 1 : 0;

  // I ref delle voci si aggiornano da soli (callback con `null` allo smontaggio): svuotarli qui,
  // dopo il commit, cancellerebbe quelli appena agganciati e il fuoco resterebbe sul token.
  useEffect(() => {
    setFocusIndex(initialFocusIndex);
    setHoverIndex(null);
    // Il fuoco alla prima voce quando il menu (o un pannello) si apre, come richiede la
    // navigazione da tastiera della spec.
    const raf = requestAnimationFrame(() => itemRefs.current[initialFocusIndex]?.focus());
    return () => cancelAnimationFrame(raf);
  }, [openPanel]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => document.removeEventListener('pointerdown', handlePointerDown, true);
  }, [onClose]);

  // Tiene i due archi, l'etichetta e il pannello dentro l'area visibile della mappa: lo
  // stage può essere più grande della finestra, quindi l'area è l'intersezione dei rettangoli degli
  // antenati che ritagliano il contenuto e della finestra. Misura l'ingombro reale senza lo
  // spostamento corrente e applica il minimo spostamento necessario; il pannello sceglie prima il
  // lato orizzontale con più spazio, così resta accanto al token invece di coprirlo.
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const clip = { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
    for (let ancestor = container.parentElement; ancestor && ancestor !== document.body; ancestor = ancestor.parentElement) {
      const { overflowX, overflowY } = getComputedStyle(ancestor);
      if (overflowX === 'visible' && overflowY === 'visible') {
        continue;
      }
      const rect = ancestor.getBoundingClientRect();
      clip.left = Math.max(clip.left, rect.left);
      clip.top = Math.max(clip.top, rect.top);
      clip.right = Math.min(clip.right, rect.right);
      clip.bottom = Math.min(clip.bottom, rect.bottom);
    }

    if (openPanel && panelRef.current) {
      const anchorX = container.getBoundingClientRect().left - shift.x;
      const panelWidth = panelRef.current.getBoundingClientRect().width;
      const spaceRight = clip.right - EDGE_MARGIN - (anchorX + tokenRadius + PANEL_GAP);
      const spaceLeft = anchorX - tokenRadius - PANEL_GAP - (clip.left + EDGE_MARGIN);
      const nextSide = spaceRight >= panelWidth || spaceRight >= spaceLeft ? 'right' : 'left';
      if (nextSide !== panelSide) {
        setPanelSide(nextSide);
        return;
      }
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    container.querySelectorAll<HTMLElement>('*').forEach((element) => {
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        return;
      }
      minX = Math.min(minX, rect.left);
      minY = Math.min(minY, rect.top);
      maxX = Math.max(maxX, rect.right);
      maxY = Math.max(maxY, rect.bottom);
    });
    if (!Number.isFinite(minX)) {
      return;
    }

    // Con un ingombro più grande dell'area vince il bordo iniziale, così resta visibile l'inizio.
    const clampAxis = (start: number, end: number, min: number, max: number) => {
      if (start < min + EDGE_MARGIN) {
        return min + EDGE_MARGIN - start;
      }
      if (end > max - EDGE_MARGIN) {
        return Math.max(min + EDGE_MARGIN - start, max - EDGE_MARGIN - end);
      }
      return 0;
    };
    const next = {
      x: Math.round(clampAxis(minX - shift.x, maxX - shift.x, clip.left, clip.right)),
      y: Math.round(clampAxis(minY - shift.y, maxY - shift.y, clip.top, clip.bottom)),
    };
    if (next.x !== shift.x || next.y !== shift.y) {
      setShift(next);
    }
  });

  const focusIndexAt = (index: number) => {
    const bounded = ((index % activeEntries.length) + activeEntries.length) % activeEntries.length;
    setFocusIndex(bounded);
    itemRefs.current[bounded]?.focus();
  };

  const toggleCondition = (condition: TokenCondition) => {
    const checked = token.conditions.includes(condition);
    setAnnouncement(`${conditionLabel(condition)} ${checked ? 'tolto' : 'attivo'}`);
    onToggleCondition(condition);
  };

  const toggleAura = (auraId: string, active: boolean) => {
    const aura = tokenAuras.find((item) => item.id === auraId);
    setAnnouncement(`${aura?.name || 'Aura'} ${active ? 'accesa' : 'spenta'}`);
    onToggleAura?.(auraId, active);
  };

  const standUp = () => {
    setAnnouncement('Alzati');
    onStandUp();
    // «Alzati» sparisce quando Prono viene tolto: se aveva il fuoco, il fuoco passa a Prono sulla
    // corona invece di cadere sul body, dove i tasti successivi arriverebbero alla mappa.
    const proneIndex = ringEntries.findIndex((entry) => entry.kind === 'condition' && entry.condition === 'prone');
    requestAnimationFrame(() => {
      const container = containerRef.current;
      if (container && !container.contains(document.activeElement) && proneIndex >= 0) {
        setFocusIndex(proneIndex);
        itemRefs.current[proneIndex]?.focus();
      }
    });
  };

  const setExhaustion = (level: number) => {
    const bounded = Math.min(MAX_EXHAUSTION, Math.max(MIN_EXHAUSTION, level));
    if (bounded === exhaustionLevel) {
      return;
    }
    setAnnouncement(`Indebolimento ${bounded}`);
    onSetExhaustion(bounded);
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    // `Ctrl+Z` e le altre combinazioni restano ai gestori globali; `Tab` segue il browser.
    if (event.key === 'Tab') {
      setKeyboardNavigated(true);
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    if (['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'Home', 'End'].includes(event.key)) {
      setKeyboardNavigated(true);
    }
    // Ogni altro tasto appartiene al menu: i gestori globali ascoltano su `window` e, senza
    // questo stop, frecce/WASD muoverebbero il token selezionato, `Canc` lo cancellerebbe e
    // R/P/C/O/L attiverebbero uno strumento di mappa.
    event.stopPropagation();

    // L'indice della voce a fuoco si legge dal DOM: quando «Alzati» compare o sparisce le voci
    // successive cambiano posizione, e `focusIndex` potrebbe indicare la voce accanto.
    const domIndex = itemRefs.current.findIndex((node) => node !== null && node === document.activeElement);
    const currentIndex = domIndex >= 0 ? domIndex : focusIndex;

    if (event.key === 'Escape') {
      event.preventDefault();
      if (openPanel) {
        setOpenPanel(null);
        return;
      }
      onClose();
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      event.preventDefault();
      focusIndexAt(currentIndex + 1);
      return;
    }
    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      event.preventDefault();
      focusIndexAt(currentIndex - 1);
      return;
    }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      focusIndexAt(event.key === 'Home' ? 0 : activeEntries.length - 1);
      return;
    }
    if (!isVehicle && /^[0-6]$/.test(event.key)) {
      event.preventDefault();
      setExhaustion(Number(event.key));
      return;
    }
    if (event.key.length === 1) {
      const key = event.key.toUpperCase();
      if (key === STAND_UP_ACCESS_KEY && isProne) {
        event.preventDefault();
        standUp();
        return;
      }
      if (key === AURAS_ACCESS_KEY && canShowAuras) {
        event.preventDefault();
        setOpenPanel('auras');
        return;
      }
      const condition = catalog.find((candidate) => CONDITION_ACCESS_KEYS[candidate] === key);
      if (condition) {
        event.preventDefault();
        toggleCondition(condition);
      }
    }
  };

  const itemProps = (index: number) => ({
    ref: (node: HTMLButtonElement | null) => {
      itemRefs.current[index] = node;
    },
    tabIndex: index === focusIndex ? 0 : -1,
    onFocus: () => setFocusIndex(index),
    onPointerEnter: () => setHoverIndex(index),
    onPointerLeave: () => setHoverIndex((current) => (current === index ? null : current)),
  });

  const renderRingEntry = (entry: MenuEntry, index: number) => {
    const offset = ringOffset(index, statusCount, ringRadius, 'status');
    const style = { transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))` };
    if (entry.kind !== 'condition') {
      return null;
    }
    const checked = token.conditions.includes(entry.condition);
    const accessKey = CONDITION_ACCESS_KEYS[entry.condition];
    return (
      <button
        key={entry.condition}
        {...itemProps(index)}
        type="button"
        role="menuitemcheckbox"
        aria-checked={checked}
        aria-label={conditionLabel(entry.condition)}
        aria-keyshortcuts={accessKey}
        className={`token-radial-menu__ring-item ${checked ? 'token-radial-menu__ring-item--active' : ''}`}
        style={style}
        onClick={() => toggleCondition(entry.condition)}
      >
        <ConditionBadge condition={entry.condition} showLabel={false} />
        {checked ? <CheckPip /> : null}
      </button>
    );
  };

  const renderExtraEntry = (entry: MenuEntry, index: number) => {
    const isStatus = entry.kind === 'more';
    const actionIndex = extraEntries.slice(0, index - ringEntries.length).filter((item) => item.kind !== 'more').length;
    const offset = ringOffset(isStatus ? ringEntries.length : actionIndex, isStatus ? statusCount : actionCount, ringRadius, isStatus ? 'status' : 'action');
    const style = { transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))` };
    if (entry.kind === 'more') {
      return (
        <button
          key="more"
          {...itemProps(index)}
          type="button"
          role="menuitem"
          aria-haspopup="menu"
          className="token-radial-menu__item token-radial-menu__item--more"
          style={style}
          aria-label="Altre condizioni"
          onClick={() => setOpenPanel('more')}
        >
          <StrokeIcon>
            <path d="M8 3v10M3 8h10" />
          </StrokeIcon>
          <span className="visually-hidden">Altre condizioni</span>
        </button>
      );
    }

    if (entry.kind === 'stand-up') {
      return (
        <button
          key="stand-up"
          {...itemProps(index)}
          type="button"
          role="menuitem"
          aria-label="Alzati, costa metà del movimento"
          aria-keyshortcuts={STAND_UP_ACCESS_KEY}
          className="token-radial-menu__item token-radial-menu__item--action"
          style={style}
          onClick={standUp}
        >
          <StrokeIcon>
            <path d="M8 13V3.5M4 7l4-4 4 4" />
          </StrokeIcon>
        </button>
      );
    }

    if (entry.kind === 'dash') {
      return (
        <button
          key="dash"
          {...itemProps(index)}
          type="button"
          role="menuitem"
          aria-disabled={dashStatus !== null}
          aria-label={dashStatus ? `Scatto, ${dashStatus}` : 'Scatto'}
          className="token-radial-menu__item token-radial-menu__item--action"
          style={style}
          onClick={() => {
            if (canDash && !dashUsed) {
              onDash?.();
            }
          }}
        >
          <StrokeIcon>
            <path d="M3 4l4 4-4 4M8.5 4l4 4-4 4" />
          </StrokeIcon>
        </button>
      );
    }

    if (entry.kind !== 'auras') {
      return null;
    }
    return (
      <button
        key="auras"
        {...itemProps(index)}
        type="button"
        role="menuitem"
        aria-haspopup="menu"
        aria-keyshortcuts={AURAS_ACCESS_KEY}
        aria-label="Aure"
        className="token-radial-menu__item token-radial-menu__item--action"
        style={style}
        onClick={() => setOpenPanel('auras')}
      >
        <StrokeIcon>
          <circle cx="8" cy="8" r="4.5" />
        </StrokeIcon>
      </button>
    );
  };

  // Testo della voce indicata dal puntatore o, in mancanza, da quella a fuoco: nome, stato e
  // tasto, visibile senza tooltip. È `aria-hidden` perché il nome accessibile sta già sulla voce.
  const describeEntry = (entry: MenuEntry | undefined) => {
    if (!entry) {
      return null;
    }
    switch (entry.kind) {
      case 'condition': {
        const checked = token.conditions.includes(entry.condition);
        return {
          label: conditionLabel(entry.condition),
          accessKey: CONDITION_ACCESS_KEYS[entry.condition],
          detail: checked ? 'attivo' : null,
        };
      }
      case 'stand-up':
        return { label: 'Alzati', accessKey: STAND_UP_ACCESS_KEY, detail: '½ movimento' };
      case 'more':
        return { label: 'Altre condizioni', accessKey: null, detail: null };
      case 'dash':
        return { label: 'Scatto', accessKey: null, detail: dashStatus ?? 'azione' };
      case 'auras':
        return { label: 'Aure', accessKey: AURAS_ACCESS_KEY, detail: null };
      default:
        return null;
    }
  };
  const highlightedIndex = hoverIndex ?? (keyboardNavigated ? focusIndex : null);
  const highlighted = highlightedIndex === null ? null : describeEntry(mainEntries[highlightedIndex]);

  const renderPanelEntry = (entry: MenuEntry, index: number) => {
    if (entry.kind !== 'condition') {
      return null;
    }
    const checked = token.conditions.includes(entry.condition);
    const accessKey = CONDITION_ACCESS_KEYS[entry.condition];
    const label = conditionLabel(entry.condition);
    return (
      <button
        key={entry.condition}
        {...itemProps(index)}
        type="button"
        role="menuitemcheckbox"
        aria-checked={checked}
        aria-label={label}
        aria-keyshortcuts={accessKey}
        className={`token-radial-menu__item ${checked ? 'token-radial-menu__item--active' : ''}`}
        onClick={() => toggleCondition(entry.condition)}
      >
        <ConditionBadge condition={entry.condition} showLabel={false} />
        <span className="token-radial-menu__item-label" aria-hidden="true">
          <AccessKeyLabel label={label} accessKey={accessKey} />
        </span>
        {checked ? <CheckPip /> : null}
      </button>
    );
  };

  const renderAuraPanelEntry = (entry: MenuEntry, index: number) => {
    if (entry.kind !== 'aura-toggle') {
      return null;
    }
    const aura = tokenAuras.find((item) => item.id === entry.auraId);
    if (!aura) {
      return null;
    }
    const checked = aura.active;
    const label = aura.name || 'Aura';
    return (
      <button
        key={entry.auraId}
        {...itemProps(index)}
        type="button"
        role="menuitemcheckbox"
        aria-checked={checked}
        aria-label={label}
        className={`token-radial-menu__item ${checked ? 'token-radial-menu__item--active' : ''}`}
        onClick={() => toggleAura(aura.id, !checked)}
      >
        <span className="token-radial-menu__aura-swatch" style={{ backgroundColor: aura.color }} aria-hidden="true" />
        <span className="token-radial-menu__item-label" aria-hidden="true">{label}</span>
        {checked ? <CheckPip /> : null}
      </button>
    );
  };

  const exhaustionDownIndex = panelEntries.findIndex((entry) => entry.kind === 'exhaustion-down');
  const exhaustionUpIndex = panelEntries.findIndex((entry) => entry.kind === 'exhaustion-up');
  const exhaustionLabelId = `token-radial-menu-exhaustion-label-${token.id}`;

  return (
    <>
      {/* Esito dei tasti d'accesso per chi usa uno screen reader: la voce attivata da tastiera
          spesso non ha il fuoco, quindi il cambio di `aria-checked` non verrebbe annunciato. */}
      <span className="visually-hidden" role="status" aria-live="polite">
        {announcement}
      </span>
      <div
        ref={containerRef}
        role="menu"
        aria-label={`Condizioni e azioni di ${token.name}`}
        className="token-radial-menu"
        style={{ left: screenPosition.x + shift.x, top: screenPosition.y + shift.y }}
        onKeyDown={handleKeyDown}
      >
        {openPanel === 'auras' ? (
          <div
            ref={panelRef}
            className={`token-radial-menu__panel token-radial-menu__panel--${panelSide}`}
            style={{ left: panelSide === 'right' ? tokenRadius + PANEL_GAP : -(tokenRadius + PANEL_GAP) }}
          >
            <button
              {...itemProps(0)}
              type="button"
              role="menuitem"
              className="token-radial-menu__back"
              onClick={() => setOpenPanel(null)}
              aria-label="Torna al menu principale"
            >
              <StrokeIcon>
                <path d="M10 3 5 8l5 5" />
              </StrokeIcon>
              Aure
            </button>
            <div className="token-radial-menu__items">{auraPanelEntries.map(renderAuraPanelEntry)}</div>
          </div>
        ) : openPanel === 'more' ? (
          <div
            ref={panelRef}
            className={`token-radial-menu__panel token-radial-menu__panel--${panelSide}`}
            style={{ left: panelSide === 'right' ? tokenRadius + PANEL_GAP : -(tokenRadius + PANEL_GAP) }}
          >
            <button
              {...itemProps(0)}
              type="button"
              role="menuitem"
              className="token-radial-menu__back"
              onClick={() => setOpenPanel(null)}
              aria-label="Torna alle condizioni frequenti"
            >
              <StrokeIcon>
                <path d="M10 3 5 8l5 5" />
              </StrokeIcon>
              Frequenti
            </button>
            <div className="token-radial-menu__items">{panelEntries.map(renderPanelEntry)}</div>
            {!isVehicle ? (
              <div className="token-radial-menu__exhaustion" role="group" aria-labelledby={exhaustionLabelId}>
                <span className="token-radial-menu__exhaustion-name" id={exhaustionLabelId}>
                  <ExhaustionIcon />
                  Indebolimento
                </span>
                <span className="token-radial-menu__stepper">
                  <button
                    {...itemProps(exhaustionDownIndex)}
                    type="button"
                    role="menuitem"
                    aria-disabled={exhaustionLevel <= MIN_EXHAUSTION}
                    aria-label={`Riduci Indebolimento, ora ${exhaustionLevel}`}
                    className="token-radial-menu__step"
                    onClick={() => setExhaustion(exhaustionLevel - 1)}
                  >
                    <StrokeIcon>
                      <path d="M3.5 8h9" />
                    </StrokeIcon>
                  </button>
                  <span className="token-radial-menu__level" aria-hidden="true">
                    {exhaustionLevel}
                  </span>
                  <button
                    {...itemProps(exhaustionUpIndex)}
                    type="button"
                    role="menuitem"
                    aria-disabled={exhaustionLevel >= MAX_EXHAUSTION}
                    aria-label={`Aumenta Indebolimento, ora ${exhaustionLevel}`}
                    className="token-radial-menu__step"
                    onClick={() => setExhaustion(exhaustionLevel + 1)}
                  >
                    <StrokeIcon>
                      <path d="M8 3.5v9M3.5 8h9" />
                    </StrokeIcon>
                  </button>
                </span>
                <span className="token-radial-menu__hint" aria-hidden="true">
                  tasti 0–6
                </span>
              </div>
            ) : null}
          </div>
        ) : (
          <>
            <div className="token-radial-menu__ring">{ringEntries.map(renderRingEntry)}</div>
            {/* Sempre montata, nascosta quando nessuna voce è indicata: l'ingombro misurato per
                tenere il menu nella mappa non cambia quando l'etichetta compare. */}
            <div
              className={`token-radial-menu__caption ${highlighted ? '' : 'token-radial-menu__caption--idle'}`}
              style={{
                width: ringRadius * 2 + RING_ITEM_SIZE,
                transform: `translate(-50%, calc(-50% + ${ringRadius + LABEL_GAP}px))`,
              }}
              aria-hidden="true"
            >
              {highlighted ? (
                <>
                  <span className="token-radial-menu__caption-name">
                    {highlighted.accessKey ? (
                      <AccessKeyLabel label={highlighted.label} accessKey={highlighted.accessKey} />
                    ) : (
                      highlighted.label
                    )}
                  </span>
                  {highlighted.detail ? (
                    <span className="token-radial-menu__caption-detail">{highlighted.detail}</span>
                  ) : null}
                  {highlighted.accessKey ? <kbd className="token-radial-menu__kbd">{highlighted.accessKey}</kbd> : null}
                </>
              ) : (
                // Riga vuota con l'altezza del testo, così la pillola nascosta ha la stessa misura.
                <span className="token-radial-menu__caption-name">&nbsp;</span>
              )}
            </div>
            {extraEntries.length > 0 ? (
              <div className="token-radial-menu__extras">
                {extraEntries.map((entry, extraIndex) => renderExtraEntry(entry, ringEntries.length + extraIndex))}
              </div>
            ) : null}
          </>
        )}
      </div>
    </>
  );
}
