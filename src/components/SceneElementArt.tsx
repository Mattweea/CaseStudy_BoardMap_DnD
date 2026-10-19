import type { SceneElement } from '../types';

export const SCENE_ELEMENT_LIBRARY: Array<{ kind: SceneElement['kind']; label: string; widthCells: number; heightCells: number }> = [
  { kind: 'rock', label: 'Roccia', widthCells: 1, heightCells: 1 },
  { kind: 'crate', label: 'Cassa', widthCells: 1, heightCells: 1 },
  { kind: 'table', label: 'Tavolo', widthCells: 2, heightCells: 1 },
];

export function SceneElementArt({ kind }: { kind: SceneElement['kind'] }) {
  return (
    <svg className="scene-element-art" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      {kind === 'rock' ? (
        <>
          <path d="M11 64 19 34 42 14 68 18 90 43 83 76 57 91 27 84Z" fill="#69645d" stroke="#302d2c" strokeWidth="5" strokeLinejoin="round" />
          <path d="M19 34 42 14 50 40 32 54 11 64ZM50 40 68 18 90 43 72 60 57 91 45 69Z" fill="#aaa291" opacity=".75" />
          <path d="m32 54 18-14 22 20-15 31-30-7Z" fill="#77736c" />
          <path d="m27 84 18-15 12 22m-7-51 18-22m4 42 18-17" fill="none" stroke="#312d2b" strokeWidth="3" opacity=".55" />
        </>
      ) : kind === 'crate' ? (
        <>
          <rect x="9" y="9" width="82" height="82" rx="5" fill="#6b3b27" stroke="#2a1815" strokeWidth="5" />
          <rect x="17" y="17" width="66" height="66" fill="#a46b3e" stroke="#d09a5b" strokeWidth="2" />
          <path d="M17 38h66M17 62h66M38 17v66M62 17v66" stroke="#744528" strokeWidth="3" />
          <path d="m18 18 64 64M82 18 18 82" stroke="#4b2b20" strokeWidth="8" />
          <path d="m18 18 64 64M82 18 18 82" stroke="#c09052" strokeWidth="3" />
          <g fill="#e2bc78"><circle cx="18" cy="18" r="3"/><circle cx="82" cy="18" r="3"/><circle cx="18" cy="82" r="3"/><circle cx="82" cy="82" r="3"/></g>
        </>
      ) : (
        <>
          <rect x="6" y="12" width="88" height="76" rx="8" fill="#3f281e" stroke="#291b18" strokeWidth="5" />
          <rect x="11" y="17" width="78" height="66" rx="4" fill="#865534" stroke="#c08a50" strokeWidth="3" />
          <path d="M15 38h70M15 60h70" stroke="#51311f" strokeWidth="3" />
          <path d="M22 23v54M76 23v54" stroke="#b67a44" strokeWidth="2" opacity=".7" />
          <g fill="#d6ab69" stroke="#5a3924" strokeWidth="1"><circle cx="19" cy="25" r="3"/><circle cx="81" cy="25" r="3"/><circle cx="19" cy="75" r="3"/><circle cx="81" cy="75" r="3"/></g>
        </>
      )}
    </svg>
  );
}
