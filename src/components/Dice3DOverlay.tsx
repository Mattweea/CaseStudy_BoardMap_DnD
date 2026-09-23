import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  DicePresentationQueue,
  buildDicePresentation,
  canAnimateDice,
} from '../../shared/dice-3d-presentation.mjs';
import type { DicePresentation } from '../../shared/dice-3d-presentation.mjs';
import type { DiceRollLog } from '../types';
import type DiceBox from '@3d-dice/dice-box-threejs';

const SCENE_ID = 'authoritative-dice-3d-scene';
const RESULT_HOLD_MS = 1_800;

interface Dice3DOverlayProps {
  host: HTMLElement | null;
  deliveries: DiceRollLog[];
}

function wait(duration: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, duration));
}

export function Dice3DOverlay({ host, deliveries }: Dice3DOverlayProps) {
  const [overlayRoot] = useState(() => {
    const node = document.createElement('div');
    node.className = 'dice-3d-overlay';
    node.setAttribute('aria-hidden', 'true');
    return node;
  });
  const [presentation, setPresentation] = useState<DicePresentation | null>(null);
  const [isSettled, setIsSettled] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const hostRef = useRef(host);
  const reducedMotionRef = useRef(reducedMotion);
  const rendererRef = useRef<DiceBox | null>(null);
  const rendererPromiseRef = useRef<Promise<DiceBox> | null>(null);
  const fatalRendererErrorRef = useRef(false);
  const webglAvailableRef = useRef<boolean | null>(null);
  const abortCurrentRef = useRef<(() => void) | null>(null);
  const runRef = useRef<(log: DiceRollLog) => Promise<void>>(async () => undefined);
  const queueRef = useRef<DicePresentationQueue | null>(null);

  hostRef.current = host;
  reducedMotionRef.current = reducedMotion;

  if (!queueRef.current) {
    queueRef.current = new DicePresentationQueue({
      run: (log) => runRef.current(log),
      timeoutMs: 15_000,
      onError: (error) => {
        fatalRendererErrorRef.current = true;
        abortCurrentRef.current?.();
        try {
          rendererRef.current?.clearDice();
        } catch {
          // Il log numerico resta l'unica presentazione autorevole disponibile.
        }
        console.warn('Presentazione 3D del tiro non disponibile.', error);
      },
    });
  }

  const ensureRenderer = async () => {
    if (rendererRef.current) return rendererRef.current;
    if (rendererPromiseRef.current) return rendererPromiseRef.current;

    rendererPromiseRef.current = import('@3d-dice/dice-box-threejs').then(async ({ default: DiceBoxClass }) => {
      const renderer = new DiceBoxClass(`#${SCENE_ID}`, {
        assetPath: '/dice-box/',
        sounds: false,
        shadows: true,
        theme_surface: 'green-felt',
        theme_colorset: 'white',
        theme_texture: '',
        theme_material: 'plastic',
        gravity_multiplier: 360,
        light_intensity: 0.75,
        baseScale: 70,
        strength: 1.15,
      });
      await renderer.initialize();
      rendererRef.current = renderer;
      return renderer;
    });

    return rendererPromiseRef.current;
  };

  runRef.current = async (log) => {
    const result = buildDicePresentation(log);
    if (!result.ok || fatalRendererErrorRef.current || reducedMotionRef.current || !hostRef.current) return;

    if (webglAvailableRef.current === null) {
      webglAvailableRef.current = canAnimateDice({
        reducedMotion: false,
        createCanvas: () => document.createElement('canvas'),
      });
    }
    if (!webglAvailableRef.current) return;

    setPresentation(result.presentation);
    setIsSettled(false);
    overlayRoot.dataset.state = 'rolling';

    let aborted = false;
    try {
      const renderer = await ensureRenderer();
      if (reducedMotionRef.current || !hostRef.current) return;

      await Promise.race([
        renderer.roll(result.presentation.notation),
        new Promise<void>((resolve) => {
          abortCurrentRef.current = () => {
            aborted = true;
            resolve();
          };
        }),
      ]);

      if (!aborted) {
        setIsSettled(true);
        overlayRoot.dataset.state = 'settled';
        await Promise.race([
          wait(RESULT_HOLD_MS),
          new Promise<void>((resolve) => {
            abortCurrentRef.current = () => {
              aborted = true;
              resolve();
            };
          }),
        ]);
      }
    } catch (error) {
      fatalRendererErrorRef.current = true;
      throw error;
    } finally {
      abortCurrentRef.current = null;
      try {
        rendererRef.current?.clearDice();
      } catch (error) {
        console.warn('Pulizia della scena 3D non riuscita.', error);
      }
      overlayRoot.dataset.state = 'idle';
      setIsSettled(false);
      setPresentation(null);
    }
  };

  useEffect(() => {
    if (!host) return undefined;
    host.appendChild(overlayRoot);
    rendererRef.current?.setDimensions();
    return () => {
      if (overlayRoot.parentElement === host) host.removeChild(overlayRoot);
    };
  }, [host, overlayRoot]);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setReducedMotion(query.matches);
    query.addEventListener('change', updatePreference);
    return () => query.removeEventListener('change', updatePreference);
  }, []);

  useEffect(() => {
    if (!reducedMotion) return;
    abortCurrentRef.current?.();
    try {
      rendererRef.current?.clearDice();
    } catch (error) {
      console.warn('Interruzione della scena 3D non riuscita.', error);
    }
  }, [reducedMotion]);

  useEffect(() => {
    queueRef.current?.enqueue(deliveries);
  }, [deliveries]);

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => {
      try {
        rendererRef.current?.setDimensions();
      } catch (error) {
        console.warn('Ridimensionamento della scena 3D non riuscito.', error);
      }
    });
    observer.observe(overlayRoot);
    return () => observer.disconnect();
  }, [overlayRoot]);

  return createPortal(
    <>
      <div id={SCENE_ID} className="dice-3d-overlay__scene" />
      <div className="dice-3d-result-rail" data-state={isSettled ? 'visible' : 'hidden'}>
        {presentation ? (
          <>
            <strong className="dice-3d-result-rail__title">{presentation.label}</strong>
            <div className="dice-3d-result-rail__groups">
              {presentation.groups.map((group, index) => (
                <div className="dice-3d-result-group" key={group.id}>
                  <span className="dice-3d-result-group__label">Gruppo {index + 1}</span>
                  <span className="dice-3d-result-group__dice">
                    {group.dice.map((die) => (
                      <span
                        className={`dice-3d-result-die dice-3d-result-die--${die.disposition}`}
                        key={die.id}
                        title={`${die.id} · ${group.id}`}
                      >
                        <small>d{die.sides}</small>
                        <b>{die.label}</b>
                      </span>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </>,
    overlayRoot,
  );
}
