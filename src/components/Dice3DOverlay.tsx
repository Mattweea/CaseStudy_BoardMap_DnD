import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  DicePresentationQueue,
  buildDicePresentation,
  canAnimateDice,
  isDicePresentationSkipInput,
} from '../../shared/dice-3d-presentation.mjs';
import type { DicePresentation } from '../../shared/dice-3d-presentation.mjs';
import { DiceRollAudioController, diceLookStill } from '../../shared/dice-roll-audio.mjs';
import type { DiceRollLog } from '../types';
import type DiceBox from '@3d-dice/dice-box-threejs';

const SCENE_ID = 'authoritative-dice-3d-scene';
const RESULT_HOLD_MS = 1_800;

interface Dice3DOverlayProps {
  host: HTMLElement | null;
  deliveries: DiceRollLog[];
  animationEnabled: boolean;
  soundEnabled: boolean;
  hasUserActivated: boolean;
}

function wait(duration: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, duration));
}

export function Dice3DOverlay({
  host,
  deliveries,
  animationEnabled,
  soundEnabled,
  hasUserActivated,
}: Dice3DOverlayProps) {
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
  const animationEnabledRef = useRef(animationEnabled);
  const soundEnabledRef = useRef(soundEnabled);
  const userActivatedRef = useRef(hasUserActivated);
  const rendererRef = useRef<DiceBox | null>(null);
  const rendererPromiseRef = useRef<Promise<DiceBox> | null>(null);
  const fatalRendererErrorRef = useRef(false);
  const webglAvailableRef = useRef<boolean | null>(null);
  const abortCurrentRef = useRef<(() => void) | null>(null);
  const runRef = useRef<(log: DiceRollLog) => Promise<void>>(async () => undefined);
  const queueRef = useRef<DicePresentationQueue | null>(null);
  const audioControllerRef = useRef<DiceRollAudioController | null>(null);
  const stillnessFrameRef = useRef<number | null>(null);

  if (!audioControllerRef.current) {
    audioControllerRef.current = new DiceRollAudioController({
      createAudio: (src: string) => new Audio(src),
    });
  }

  hostRef.current = host;
  reducedMotionRef.current = reducedMotion;
  animationEnabledRef.current = animationEnabled;
  soundEnabledRef.current = soundEnabled;
  userActivatedRef.current = hasUserActivated;

  const stopStillnessWatch = useCallback(() => {
    if (stillnessFrameRef.current === null) return;
    cancelAnimationFrame(stillnessFrameRef.current);
    stillnessFrameRef.current = null;
  }, []);

  // Il suono deve seguire l'occhio: chiude appena i corpi smettono di muoversi, senza aspettare
  // che Cannon li dichiari addormentati quasi un secondo dopo. Finche' non si e' visto almeno un
  // fotogramma in movimento non si chiude nulla, altrimenti dadi ancora fermi in scena
  // spegnerebbero la raffica prima che parta.
  const watchForStillness = useCallback((renderer: DiceBox) => {
    stopStillnessWatch();
    let sawMotion = false;
    const tick = () => {
      stillnessFrameRef.current = null;
      const still = diceLookStill(renderer.diceList);
      if (!still) sawMotion = true;
      else if (sawMotion) {
        audioControllerRef.current?.settle();
        return;
      }
      stillnessFrameRef.current = requestAnimationFrame(tick);
    };
    stillnessFrameRef.current = requestAnimationFrame(tick);
  }, [stopStillnessWatch]);

  const interruptCurrentPresentation = useCallback(() => {
    abortCurrentRef.current?.();
    stopStillnessWatch();
    audioControllerRef.current?.stop();
    try {
      rendererRef.current?.clearDice();
    } catch {
      // Il risultato autorevole è già disponibile nel log numerico.
    }
  }, [stopStillnessWatch]);

  if (!queueRef.current) {
    queueRef.current = new DicePresentationQueue({
      run: (log) => runRef.current(log),
      timeoutMs: 15_000,
      onError: (error) => {
        fatalRendererErrorRef.current = true;
        interruptCurrentPresentation();
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
    if (
      !result.ok
      || fatalRendererErrorRef.current
      || reducedMotionRef.current
      || !animationEnabledRef.current
      || !hostRef.current
    ) return;

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
    let resolveAbort = () => {};
    const abortPromise = new Promise<void>((resolve) => {
      resolveAbort = resolve;
    });
    abortCurrentRef.current = () => {
      if (aborted) return;
      aborted = true;
      audioControllerRef.current?.stop();
      resolveAbort();
    };

    try {
      const renderer = await Promise.race([
        ensureRenderer(),
        abortPromise.then(() => null),
      ]);
      if (
        !renderer
        || aborted
        || reducedMotionRef.current
        || !animationEnabledRef.current
        || !hostRef.current
      ) return;

      audioControllerRef.current?.start({
        soundEnabled: soundEnabledRef.current,
        userActivated: userActivatedRef.current,
        diceCount: result.presentation.visualDice.length,
      });
      watchForStillness(renderer);

      await Promise.race([
        renderer.roll(result.presentation.notation),
        abortPromise,
      ]);

      // Rete di sicurezza: se il polling dei corpi non ha potuto chiudere la raffica (diceList
      // assente o forma inattesa), almeno qui i dadi sono certamente fermi.
      stopStillnessWatch();
      audioControllerRef.current?.settle();

      if (!aborted) {
        setIsSettled(true);
        overlayRoot.dataset.state = 'settled';
        await Promise.race([
          wait(RESULT_HOLD_MS),
          abortPromise,
        ]);
      }
    } catch (error) {
      fatalRendererErrorRef.current = true;
      throw error;
    } finally {
      abortCurrentRef.current = null;
      stopStillnessWatch();
      audioControllerRef.current?.stop();
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
    queueRef.current?.discardPending();
    interruptCurrentPresentation();
  }, [interruptCurrentPresentation, reducedMotion]);

  useEffect(() => {
    if (animationEnabled) return;
    queueRef.current?.discardPending();
    interruptCurrentPresentation();
  }, [animationEnabled, interruptCurrentPresentation]);

  useEffect(() => {
    if (!soundEnabled) {
      audioControllerRef.current?.stop();
      return;
    }
    // Il primo impatto arriverebbe in ritardo se i campioni non fossero gia' in cache.
    if (hasUserActivated) audioControllerRef.current?.prime();
  }, [hasUserActivated, soundEnabled]);

  useEffect(() => {
    if (!presentation) return undefined;
    const handleClick = (event: MouseEvent) => {
      if (isDicePresentationSkipInput(event)) interruptCurrentPresentation();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isDicePresentationSkipInput(event)) interruptCurrentPresentation();
    };
    document.addEventListener('click', handleClick, true);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [interruptCurrentPresentation, presentation]);

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
              {presentation.groups.map((group) => (
                <div className="dice-3d-result-group" key={group.id}>
                  <span className="dice-3d-result-group__dice">
                    {group.dice.map((die) => (
                      // `disposition` (kept/discarded/unresolved) resta nel dato per le voci
                      // storiche, ma la resa non lo distingue più: i dadi di una voce hanno
                      // pari enfasi, salvo la coppia non risolta che ha una tinta propria.
                      <span
                        className={`dice-3d-result-die dice-3d-result-die--${die.disposition === 'unresolved' ? 'unresolved' : 'kept'}`}
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
