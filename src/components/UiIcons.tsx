import type { SVGProps } from 'react';

// Icone di interfaccia piene, nello stesso stile dei glifi dei dadi (game-icons.net): superfici
// piene in `currentColor`, nessun tratto. Le spade incrociate riusano il tracciato di Lorc già
// attribuito per l'emblema del combattimento; le altre forme sono disegnate per il progetto.
type UiIconProps = SVGProps<SVGSVGElement> & { size?: number | string };

function iconProps({ size = 16, ...props }: UiIconProps, viewBox = '0 0 24 24') {
  return {
    width: size,
    height: size,
    viewBox,
    fill: 'currentColor',
    'aria-hidden': true,
    focusable: false,
    ...props,
  } as const;
}

export function PlayIcon(props: UiIconProps) {
  return <svg {...iconProps(props)}><path d="M7 4.5v15a1 1 0 0 0 1.52.85l12-7.5a1 1 0 0 0 0-1.7l-12-7.5A1 1 0 0 0 7 4.5z" /></svg>;
}

export function StepBackIcon(props: UiIconProps) {
  return <svg {...iconProps(props)}><path d="M17 4.5v15a1 1 0 0 1-1.52.85l-12-7.5a1 1 0 0 1 0-1.7l12-7.5A1 1 0 0 1 17 4.5z" /></svg>;
}

export function StepForwardIcon(props: UiIconProps) {
  return <PlayIcon {...props} />;
}

export function SpeakerIcon(props: UiIconProps) {
  return (
    <svg {...iconProps(props)}>
      <path d="M3 9.5v5a1 1 0 0 0 1 1h3.2l4.2 3.6a1 1 0 0 0 1.6-.8V5.7a1 1 0 0 0-1.6-.8L7.2 8.5H4a1 1 0 0 0-1 1z" />
      <path d="M15.6 8.4a5 5 0 0 1 0 7.2l-1.3-1.3a3.2 3.2 0 0 0 0-4.6z" />
      <path d="M18.2 5.8a8.7 8.7 0 0 1 0 12.4l-1.3-1.3a6.9 6.9 0 0 0 0-9.8z" />
    </svg>
  );
}

const CROSSED_SWORDS_PATH = 'M19.75 14.438c59.538 112.29 142.51 202.35 232.28 292.718l3.626 3.75.063-.062c21.827 21.93 44.04 43.923 66.405 66.25-18.856 14.813-38.974 28.2-59.938 40.312l28.532 28.53 68.717-68.717c42.337 27.636 76.286 63.646 104.094 105.81l28.064-28.06c-42.47-27.493-79.74-60.206-106.03-103.876l68.936-68.938-28.53-28.53c-11.115 21.853-24.413 42.015-39.47 60.593-43.852-43.8-86.462-85.842-130.125-125.47-.224-.203-.432-.422-.656-.625C183.624 122.75 108.515 63.91 19.75 14.437zm471.875 0c-83.038 46.28-154.122 100.78-221.97 161.156l22.814 21.562 56.81-56.812 13.22 13.187-56.438 56.44 24.594 23.186c61.802-66.92 117.6-136.92 160.97-218.72zm-329.53 125.906 200.56 200.53a402.965 402.965 0 0 1-13.405 13.032L148.875 153.53l13.22-13.186zm-76.69 113.28-28.5 28.532 68.907 68.906c-26.29 43.673-63.53 76.414-106 103.907l28.063 28.06c27.807-42.164 61.758-78.174 104.094-105.81l68.718 68.717 28.53-28.53c-20.962-12.113-41.08-25.5-59.937-40.313 17.865-17.83 35.61-35.433 53.157-52.97l-24.843-25.655-55.47 55.467c-4.565-4.238-9.014-8.62-13.374-13.062l55.844-55.844-24.53-25.374c-18.28 17.856-36.602 36.06-55.158 54.594-15.068-18.587-28.38-38.758-39.5-60.625z';

export function CrossedSwordsIcon(props: UiIconProps) {
  return <svg {...iconProps(props, '0 0 512 512')}><path d={CROSSED_SWORDS_PATH} /></svg>;
}

export function ArrowUpIcon(props: UiIconProps) {
  return <svg {...iconProps(props)}><path d="M12 4.2a1 1 0 0 1 .74.33l6 6.6A1 1 0 0 1 18 12.8h-4v6a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-6H6a1 1 0 0 1-.74-1.67l6-6.6A1 1 0 0 1 12 4.2z" /></svg>;
}

export function ArrowDownIcon(props: UiIconProps) {
  return <ArrowUpIcon {...props} style={{ transform: 'rotate(180deg)', ...props.style }} />;
}

export function CloseIcon(props: UiIconProps) {
  return <svg {...iconProps(props)}><path d="M6.2 4.8 12 10.6l5.8-5.8a1 1 0 0 1 1.4 1.4L13.4 12l5.8 5.8a1 1 0 0 1-1.4 1.4L12 13.4l-5.8 5.8a1 1 0 0 1-1.4-1.4l5.8-5.8-5.8-5.8a1 1 0 0 1 1.4-1.4z" /></svg>;
}

// Set esteso (sostituisce emoji e simboli Unicode in tutta l'app). Stesse regole: forme piene,
// griglia 24, `currentColor`. Senza `size` esplicito l'icona segue il corpo del testo (1.1em).
function glyph(d: string, props: UiIconProps, evenOdd = false) {
  const { size = '1.1em', className, ...rest } = props;
  return (
    <svg {...iconProps({ size, ...rest })} className={['ui-icon', className].filter(Boolean).join(' ')}>
      <path d={d} fillRule={evenOdd ? 'evenodd' : undefined} />
    </svg>
  );
}

const ARROW_UP_PATH = 'M12 4.2a1 1 0 0 1 .74.33l6 6.6A1 1 0 0 1 18 12.8h-4v6a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-6H6a1 1 0 0 1-.74-1.67l6-6.6A1 1 0 0 1 12 4.2z';

// Freccia di direzione per il pad di movimento: 0 = su, poi in senso orario a passi di 45°.
export function DirectionArrowIcon({ angle, size = '1.1em', ...props }: UiIconProps & { angle: number }) {
  return (
    <svg {...iconProps({ size, ...props })} className="ui-icon">
      <path d={ARROW_UP_PATH} transform={`rotate(${angle} 12 12)`} />
    </svg>
  );
}

export const DashIcon = (props: UiIconProps) => glyph('M3 5.5v13a1 1 0 0 0 1.6.8L12 13.7v4.8a1 1 0 0 0 1.6.8l8.4-6.5a1 1 0 0 0 0-1.6l-8.4-6.5a1 1 0 0 0-1.6.8v4.8L4.6 4.7A1 1 0 0 0 3 5.5z', props);
export const UndoIcon = (props: UiIconProps) => glyph('M9.5 4.3a1 1 0 0 1 0 1.4L7.2 8H14a6.5 6.5 0 0 1 0 13h-3a1 1 0 0 1 0-2h3a4.5 4.5 0 0 0 0-9H7.2l2.3 2.3a1 1 0 1 1-1.4 1.4l-4-4a1 1 0 0 1 0-1.4l4-4a1 1 0 0 1 1.4 0z', props);
export const SaveIcon = (props: UiIconProps) => glyph('M5 3h11.6a1 1 0 0 1 .7.3l3.4 3.4a1 1 0 0 1 .3.7V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm2 2v4h8V5H7zm5 8a3 3 0 1 0 0 6 3 3 0 0 0 0-6z', props, true);
export const ResumeIcon = (props: UiIconProps) => glyph('M12 3a9 9 0 1 1-8.5 6.1 1 1 0 1 1 1.9.6A7 7 0 1 0 7.1 7H9a1 1 0 0 1 0 2H4.5a1 1 0 0 1-1-1V3.5a1 1 0 0 1 2 0v1.8A8.96 8.96 0 0 1 12 3zm-1.6 5.6 5 3a.5.5 0 0 1 0 .8l-5 3a.5.5 0 0 1-.8-.4v-6a.5.5 0 0 1 .8-.4z', props);
export const PlusIcon = (props: UiIconProps) => glyph('M12 4a1 1 0 0 1 1 1v6h6a1 1 0 0 1 0 2h-6v6a1 1 0 0 1-2 0v-6H5a1 1 0 0 1 0-2h6V5a1 1 0 0 1 1-1z', props);
export const MapIcon = (props: UiIconProps) => glyph('M9 3.2 15 5.6l5.3-2.1a1 1 0 0 1 1.4.9v14a1 1 0 0 1-.6.9L15 21.8l-6-2.4-5.3 2.1a1 1 0 0 1-1.4-.9v-14a1 1 0 0 1 .6-.9L9 3.2zm1 2.3v12.3l4 1.6V7.1l-4-1.6z', props, true);
export const MoonIcon = (props: UiIconProps) => glyph('M20.5 14.6A8.5 8.5 0 1 1 9.4 3.5a1 1 0 0 1 1.2 1.3 6.5 6.5 0 0 0 8.6 8.6 1 1 0 0 1 1.3 1.2z', props);
export const TrashIcon = (props: UiIconProps) => glyph('M9 2.5h6a1 1 0 0 1 1 1V5h4a1 1 0 0 1 0 2h-1.1l-.9 13.1A2 2 0 0 1 16 22H8a2 2 0 0 1-2-1.9L5.1 7H4a1 1 0 0 1 0-2h4V3.5a1 1 0 0 1 1-1zm1 2.5h4v-.5h-4V5zm-.5 5v8h1.6v-8H9.5zm3.4 0v8h1.6v-8h-1.6z', props, true);
export const PinIcon = (props: UiIconProps) => glyph('M15.6 2.6a1 1 0 0 1 1.4 0l4.4 4.4a1 1 0 0 1 0 1.4l-1.7 1.7a1 1 0 0 1-1.1.2l-2.9 2.9.4 3.6a1 1 0 0 1-.3.8l-1 1a1 1 0 0 1-1.4 0l-3.1-3.1-4.6 4.6a1 1 0 0 1-1.4-1.4l4.6-4.6-3.1-3.1a1 1 0 0 1 0-1.4l1-1a1 1 0 0 1 .8-.3l3.6.4 2.9-2.9a1 1 0 0 1 .2-1.1z', props);
export const SidebarIcon = (props: UiIconProps) => glyph('M4 4h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zm10 2v12h5V6h-5z', props, true);
export const PawnIcon = (props: UiIconProps) => glyph('M12 2.5a3.5 3.5 0 0 1 2.2 6.2A4.5 4.5 0 0 1 15.5 12h-1.2l1.2 5H17a1 1 0 0 1 1 1v2.5a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V18a1 1 0 0 1 1-1h1.5l1.2-5H8.5a4.5 4.5 0 0 1 1.3-3.3A3.5 3.5 0 0 1 12 2.5z', props);
export const GearIcon = (props: UiIconProps) => glyph('M12.00 3.60 L14.15 1.21 L16.21 1.84 L16.67 5.02 L17.94 6.06 L21.15 5.89 L22.16 7.79 L20.24 10.36 L20.40 12.00 L22.79 14.15 L22.16 16.21 L18.98 16.67 L17.94 17.94 L18.11 21.15 L16.21 22.16 L13.64 20.24 L12.00 20.40 L9.85 22.79 L7.79 22.16 L7.33 18.98 L6.06 17.94 L2.85 18.11 L1.84 16.21 L3.76 13.64 L3.60 12.00 L1.21 9.85 L1.84 7.79 L5.02 7.33 L6.06 6.06 L5.89 2.85 L7.79 1.84 L10.36 3.76Z M15.4 12a3.4 3.4 0 1 0 -6.8 0a3.4 3.4 0 1 0 6.8 0z', props, true);
export const KeyboardIcon = (props: UiIconProps) => glyph('M3 6h18a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zm2 3v2h2V9H5zm4 0v2h2V9H9zm4 0v2h2V9h-2zm4 0v2h2V9h-2zM7 13v2h10v-2H7z', props, true);
export const BlockIcon = (props: UiIconProps) => glyph('M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm-5 8.5v3h10v-3H7z', props, true);
export const ExpandIcon = (props: UiIconProps) => glyph('M4 4h6v2H6v4H4V4zm10 0h6v6h-2V6h-4V4zM4 14h2v4h4v2H4v-6zm14 0h2v6h-6v-2h4v-4z', props);
export const CollapseIcon = (props: UiIconProps) => glyph('M8 4h2v6H4V8h4V4zm6 0h2v4h4v2h-6V4zM4 14h6v6H8v-4H4v-2zm10 0h6v2h-4v4h-2v-6z', props);
export const SearchIcon = (props: UiIconProps) => glyph('M10.5 3a7.5 7.5 0 0 1 6 12l4.2 4.3a1 1 0 0 1-1.4 1.4L15 16.5A7.5 7.5 0 1 1 10.5 3zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11z', props, true);
export const BookIcon = (props: UiIconProps) => glyph('M3 5.2a1 1 0 0 1 1-1c2.8 0 5.3.7 7 2v13.3c-1.7-1.2-4.1-1.8-7-1.8a1 1 0 0 1-1-1V5.2zm18 0v11.5a1 1 0 0 1-1 1c-2.9 0-5.3.6-7 1.8V6.2c1.7-1.3 4.2-2 7-2a1 1 0 0 1 1 1z', props);
export const RulerIcon = (props: UiIconProps) => glyph('M15.3 2.3a1 1 0 0 1 1.4 0l5 5a1 1 0 0 1 0 1.4L8.7 21.7a1 1 0 0 1-1.4 0l-5-5a1 1 0 0 1 0-1.4L15.3 2.3zm-1.4 3.8-1.4 1.4 1.5 1.5 1.4-1.4-1.5-1.5zm-3 3-1.4 1.4 2.2 2.2 1.4-1.4-2.2-2.2zm-3 3-1.4 1.4 1.5 1.5 1.4-1.4-1.5-1.5z', props, true);
export const PingIcon = (props: UiIconProps) => glyph('M12 2a7 7 0 0 1 7 7c0 5.2-6 12.2-6.3 12.5a1 1 0 0 1-1.4 0C11 21.2 5 14.2 5 9a7 7 0 0 1 7-7zm0 4.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z', props, true);
export const CircleTemplateIcon = (props: UiIconProps) => glyph('M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zm0 2.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13z', props, true);
export const ConeTemplateIcon = (props: UiIconProps) => glyph('M2.5 12L17.05 -0.21A19 19 0 0 1 20.81 6.92ZM2.5 12L21.08 8.05A19 19 0 0 1 21.08 15.95ZM2.5 12L20.81 17.08A19 19 0 0 1 17.05 24.21Z', props);
export const LineTemplateIcon = (props: UiIconProps) => glyph('M4.3 18.3 16.6 6H13a1 1 0 0 1 0-2h6a1 1 0 0 1 1 1v6a1 1 0 0 1-2 0V7.4L5.7 19.7a1 1 0 0 1-1.4-1.4z', props);
export const SparkIcon = (props: UiIconProps) => glyph('M12 3c.6 5.4 3.6 8.4 9 9-5.4.6-8.4 3.6-9 9-.6-5.4-3.6-8.4-9-9 5.4-.6 8.4-3.6 9-9z', props);
export const LockIcon = (props: UiIconProps) => glyph('M12 2.5A4.5 4.5 0 0 1 16.5 7v3h.5a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h.5V7A4.5 4.5 0 0 1 12 2.5zm0 2A2.5 2.5 0 0 0 9.5 7v3h5V7A2.5 2.5 0 0 0 12 4.5z', props, true);
export const UnlockIcon = (props: UiIconProps) => glyph('M12 2.5A4.5 4.5 0 0 1 16.5 7a1 1 0 0 1-2 0 2.5 2.5 0 0 0-5 0v3H17a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h.5V7A4.5 4.5 0 0 1 12 2.5z', props);
export const ChatDiceIcon = (props: UiIconProps) => glyph('M4 3h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-7.6l-4.8 3.8A1 1 0 0 1 6 20v-3H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm4 4.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm8 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm-4 2a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z', props, true);

// Indicatore di competenza della scheda: anello vuoto, pieno, anello con punto (esperto).
export function ProficiencyMarkIcon({ level, ...props }: UiIconProps & { level: 'none' | 'proficient' | 'expertise' }) {
  const d = level === 'proficient'
    ? 'M12 4a8 8 0 1 1 0 16 8 8 0 0 1 0-16z'
    : level === 'expertise'
      ? 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zm0 2a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm0 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8z'
      : 'M12 4a8 8 0 1 1 0 16 8 8 0 0 1 0-16zm0 2a6 6 0 1 0 0 12 6 6 0 0 0 0-12z';
  return glyph(d, { size: '0.9em', ...props }, level !== 'proficient');
}
