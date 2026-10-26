import { useEffect, useRef, useState } from 'react';
import {
  creatureSheetApi,
  type CreatureContext,
  type CreatureRecord,
  type CreatureSavePreview,
} from '../../utils/creatureSheetApi';
import type { CharacterSheetData, CharacterSheetPatchOperation } from '../../types/character-sheet';
import type { DiceRollLog, DiceRollSourceRequest, MeasurementUnit, SessionMode } from '../../types';
import { applySheetOperation, type MonsterData } from '../../../shared/creature-sheet-data.mjs';
import { EVENTS_URL } from '../../utils/api';
import { CharacterTab } from '../character-sheet/CharacterTab';
import { StoryTab } from '../character-sheet/StoryTab';
import { SpellsTab } from '../character-sheet/SpellsTab';
import { Modal } from '../Modal';
import { MonsterSheetEditor } from './MonsterSheetEditor';
import '../../styles/character-sheet.css';

export function CreatureSheetWindow({
  sceneId,
  tokenId,
  onClose,
  onRoll,
  diceLogs,
  measurementUnit,
  sessionMode,
  canRoll = true,
}: {
  sceneId: string;
  tokenId: string;
  onClose: () => void;
  onRoll: (request: DiceRollSourceRequest) => void;
  diceLogs: DiceRollLog[];
  measurementUnit: MeasurementUnit;
  sessionMode: SessionMode;
  canRoll?: boolean;
}) {
  const [context, setContext] = useState<CreatureContext | null>(null),
    [record, setRecord] = useState<CreatureRecord | null>(null);
  const [draft, setDraft] = useState<CreatureRecord['data'] | null>(null),
    [portrait, setPortrait] = useState<string | undefined>();
  const [tab, setTab] = useState('character'),
    [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<CreatureSavePreview | null>(null),
    [chooseSheet, setChooseSheet] = useState(''),
    [related, setRelated] = useState(false);
  const [closeConfirm, setCloseConfirm] = useState(false),
    [visibility, setVisibility] = useState<'public' | 'secret'>('public');
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const pending = useRef(false);
  const ref = useRef<HTMLDivElement>(null),
    drag = useRef<{ x: number; y: number } | null>(null);
  const dirty = !!record && (!!portrait || JSON.stringify(record.data) !== JSON.stringify(draft));
  const modalOpen = useRef(false);
  modalOpen.current = !!preview || closeConfirm;
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const closing = useRef(() => {});
  closing.current = () => {
    if (dirtyRef.current) setCloseConfirm(true);
    else onClose();
  };
  const accept = (next: CreatureRecord) => {
    setError(null);
    setRecord(next);
    setDraft(structuredClone(next.data));
    setPortrait(undefined);
    setPreview(null);
  };
  const load = async () => {
    setBusy(true);
    setError(null);
    try {
      const value = await creatureSheetApi.context(sceneId, tokenId);
      setContext(value);
      if (value.record) accept(value.record);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Scheda non disponibile.');
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    void load();
  }, [sceneId, tokenId]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    ref.current?.querySelector<HTMLButtonElement>('[data-sheet-close]')?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !modalOpen.current && !document.querySelector('.modal-backdrop[data-state="open"]')) {
        e.stopPropagation();
        closing.current();
      }
    };
    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
      previous?.focus();
    };
  }, []);
  useEffect(() => {
    if (!record) return;
    const events = new EventSource(EVENTS_URL, { withCredentials: true });
    const update = (event: MessageEvent) => {
      try {
        const value = JSON.parse(event.data);
        if (value.sheetId !== record.sheetId && value.bindingId !== record.id) return;
        if (pending.current) return;
        if (dirtyRef.current) {
          setError('Scheda modificata in un’altra finestra. La tua bozza è conservata: aggiorna prima di salvarla.');
          return;
        }
        void creatureSheetApi
          .get(record.id)
          .then(accept)
          .catch((e) => setError(e.message));
      } catch {}
    };
    events.addEventListener('creature-sheet-saved', update);
    return () => events.close();
  }, [record?.id, record?.sheetId]);
  useEffect(() => {
    if (!preview && !closeConfirm) return;
    const frame = requestAnimationFrame(() =>
      document.querySelector<HTMLElement>('.creature-sheet-confirm [role="dialog"] button')?.focus(),
    );
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const dialog = document.querySelector<HTMLElement>('.creature-sheet-confirm [role="dialog"][data-state="open"]');
      const controls = dialog?.querySelectorAll<HTMLElement>(
        'button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex="0"]',
      );
      if (!controls?.length) return;
      const first = controls[0],
        last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', trap);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('keydown', trap);
      ref.current?.querySelector<HTMLElement>('[data-creature-save]')?.focus();
    };
  }, [preview, closeConfirm]);
  useEffect(() => {
    const resize = () =>
      setPosition((current) => {
        if (!current || window.innerWidth <= 820) return null;
        const box = ref.current?.getBoundingClientRect();
        if (!box) return current;
        return {
          x: Math.max(8, Math.min(window.innerWidth - box.width - 8, current.x)),
          y: Math.max(8, Math.min(window.innerHeight - box.height - 8, current.y)),
        };
      });
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  const withError = async (action: () => Promise<void>) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Operazione non riuscita.');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  const patch = (operation: CharacterSheetPatchOperation) => {
    if (!draft) return;
    const copy = structuredClone(draft);
    applySheetOperation(copy, operation);
    setDraft(copy);
  };
  const commit = async (scope: 'one' | 'all', confirmation: CreatureSavePreview) => {
    if (!record || !draft) return;
    await withError(async () =>
      accept(await creatureSheetApi.save(record, draft, confirmation.signature, scope, portrait)),
    );
  };
  const save = async () => {
    if (!record || !draft) return;
    await withError(async () => {
      const confirmation = await creatureSheetApi.preview(record, draft);
      if (confirmation.targets.length > 1) setPreview(confirmation);
      else accept(await creatureSheetApi.save(record, draft, confirmation.signature, 'one', portrait));
    });
  };
  const upload = (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      setError('Ritratto: massimo 5 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPortrait(String(reader.result));
    reader.readAsDataURL(file);
  };
  const roll = (request: DiceRollSourceRequest) => {
    if (!canRoll) {
      setError('Attiva questa scena prima di tirare per la creatura.');
      return;
    }
    if (dirty) {
      setError('Salva prima la bozza: i dadi usano soltanto la scheda confermata.');
      return;
    }
    onRoll(request);
  };
  const adjust = async (delta: number) => {
    if (!draft || !record) return;
    await withError(async () => setDraft((await creatureSheetApi.previewHitPoints(record, draft, delta)).data));
  };

  const move = (x: number, y: number) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    setPosition({
      x: Math.max(8, Math.min(window.innerWidth - box.width - 8, x)),
      y: Math.max(8, Math.min(window.innerHeight - box.height - 8, y)),
    });
  };
  return (
    <div className="character-sheet-overlay">
      <div
        ref={ref}
        className={`character-sheet-window creature-sheet-window${position ? ' character-sheet-window--positioned' : ''}`}
        role="dialog"
        aria-modal="false"
        aria-labelledby="creature-sheet-title"
        style={position ? { left: position.x, top: position.y } : undefined}
      >
        <header
          className="character-sheet-window__bar"
          tabIndex={0}
          aria-label="Sposta la scheda creatura. Alt e frecce per spostare."
          onPointerDown={(e) => {
            if ((e.target as HTMLElement).closest('button,input') || e.button !== 0 || window.innerWidth <= 820) return;
            const box = ref.current!.getBoundingClientRect();
            drag.current = { x: e.clientX - box.left, y: e.clientY - box.top };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (drag.current) move(e.clientX - drag.current.x, e.clientY - drag.current.y);
          }}
          onPointerUp={() => {
            drag.current = null;
          }}
          onPointerCancel={() => {
            drag.current = null;
          }}
          onKeyDown={(e) => {
            if (!e.altKey || e.target !== e.currentTarget) return;
            const delta = (
              { ArrowLeft: [-16, 0], ArrowRight: [16, 0], ArrowUp: [0, -16], ArrowDown: [0, 16] } as Record<
                string,
                number[]
              >
            )[e.key];
            if (!delta) return;
            e.preventDefault();
            const box = ref.current!.getBoundingClientRect();
            move(box.left + delta[0], box.top + delta[1]);
          }}
        >
          <div>
            <p>
              Archivio del Master · {record?.kind === 'monster' || context?.kind === 'monster' ? 'Mostro' : 'PG / PNG'}
            </p>
            <h2 id="creature-sheet-title">{record?.name ?? 'Scheda creatura'}</h2>
          </div>
          {record ? (
            <>
              <button
                className="sheet-roll-visibility"
                type="button"
                disabled={busy}
                onClick={() => setVisibility(visibility === 'public' ? 'secret' : 'public')}
              >
                Tiri: {visibility === 'public' ? 'Pubblici' : 'Segreti'}
              </button>
              <span role="status">{busy ? 'Salvataggio…' : dirty ? 'Modifica in corso' : 'Salvato'}</span>
              <button
                className="primary-button"
                type="button"
                data-creature-save
                disabled={busy || !dirty}
                onClick={() => void save()}
              >
                Salva
              </button>
            </>
          ) : null}
          <button
            className="character-sheet-window__close"
            type="button"
            data-sheet-close
            onClick={() => closing.current()}
            aria-label="Chiudi scheda creatura"
          >
            ×
          </button>
        </header>
        {error ? (
          <div role="alert" className="sheet-alert">
            <p>{error}</p>
            {record ? (
              <button className="secondary-button" type="button" disabled={busy} onClick={() => setCloseConfirm(true)}>
                Ricarica o scarta bozza
              </button>
            ) : null}
          </div>
        ) : null}
        {record?.kind === 'character' ? (
          <nav className="character-sheet-tabs" aria-label="Sezioni della scheda" role="tablist">
            {[
              ['character', 'Personaggio e combattimento'],
              ['story', 'Aspetto e storia'],
              ['spells', 'Incantesimi'],
            ].map(([key, label]) => (
              <button
                className="secondary-button"
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                onKeyDown={(event) => {
                  if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
                  event.preventDefault();
                  const tabs = ['character', 'story', 'spells'];
                  const next = (tabs.indexOf(key) + (event.key === 'ArrowRight' ? 1 : 2)) % 3;
                  setTab(tabs[next]);
                  requestAnimationFrame(() =>
                    ref.current?.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus(),
                  );
                }}
              >
                {label}
              </button>
            ))}
          </nav>
        ) : null}
        <div className="character-sheet-window__scroll" role="tabpanel">
          <fieldset disabled={busy} className="creature-sheet-draft">
            {!context ? (
              <p>Caricamento…</p>
            ) : !record ? (
              <div className="character-sheet-page">
                <h3>{context.kind === 'monster' ? 'Blocco statistiche del mostro' : 'Scheda PG / PNG'}</h3>
                <label>
                  Scheda
                  <select value={chooseSheet} onChange={(e) => setChooseSheet(e.target.value)}>
                    <option value="">Crea nuova scheda</option>
                    {context.sheets.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                {context.related.length > 1 ? (
                  <label>
                    <input type="checkbox" checked={related} onChange={(e) => setRelated(e.target.checked)} />
                    Usa la stessa scheda per tutte le copie ({context.related.length}):{' '}
                    {context.related.map((r) => r.name).join(', ')}
                  </label>
                ) : null}
                <button
                  className="secondary-button"
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void withError(async () =>
                      accept(await creatureSheetApi.bind(sceneId, tokenId, chooseSheet, related)),
                    )
                  }
                >
                  {chooseSheet ? 'Collega scheda' : 'Crea scheda'}
                </button>
              </div>
            ) : draft && record.kind === 'monster' ? (
              <>
                <div className="character-sheet-page">
                  <label>
                    Ritratto
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) upload(file);
                        e.target.value = '';
                      }}
                    />
                  </label>
                  {portrait || record.portraitUrl ? (
                    <img
                      className="monster-stat-block__portrait"
                      src={portrait ?? record.portraitUrl ?? ''}
                      alt="Ritratto mostro"
                    />
                  ) : null}
                </div>
                <MonsterSheetEditor
                  data={draft as MonsterData}
                  onChange={setDraft}
                  onRoll={(target) => roll({ source: { sheetId: record.id, target }, visibility })}
                />
              </>
            ) : draft ? (
              tab === 'character' ? (
                <CharacterTab
                  data={draft as CharacterSheetData}
                  patch={patch}
                  onAdjustHitPoints={adjust}
                  sheetId={record.id}
                  onRoll={roll}
                  diceLogs={diceLogs}
                  rollVisibility={visibility}
                  sessionMode={sessionMode}
                  measurementUnit={measurementUnit}
                />
              ) : tab === 'story' ? (
                <StoryTab
                  data={draft as CharacterSheetData}
                  patch={patch}
                  portraitUrl={portrait ?? record.portraitUrl}
                  onPortrait={upload}
                />
              ) : (
                <SpellsTab data={draft as CharacterSheetData} patch={patch} />
              )
            ) : null}
            {record ? (
              <div className="character-sheet-page">
                <small>
                  {record.targets.length} creature collegate. PF correnti, condizioni e risorse restano individuali.
                </small>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={busy || dirty}
                  onClick={() =>
                    void withError(async () => {
                      await creatureSheetApi.unbind(record.id);
                      setRecord(null);
                      setDraft(null);
                      await load();
                    })
                  }
                >
                  Scollega questa creatura
                </button>
              </div>
            ) : null}
          </fieldset>
        </div>
      </div>
      <Modal
        backdropClassName="creature-sheet-confirm"
        title="Applica le modifiche alle schede condivise?"
        isOpen={preview !== null}
        onClose={() => setPreview(null)}
      >
        <p>
          Modifiche ai dati comuni applicabili alle seguenti schede. PF correnti, temporanei e risorse consumate
          cambiano soltanto per la creatura aperta.
        </p>
        <ul>
          {preview?.targets.map((t) => (
            <li key={t.id}>
              <strong>{t.name}</strong> · {t.sceneName}{' '}
              {preview.targets.filter((other) => other.name === t.name && other.sceneId === t.sceneId).length > 1 ? (
                <small title={t.tokenId}>Rif. {t.tokenId.slice(0, 8)}</small>
              ) : null}
            </li>
          ))}
        </ul>
        <div className="token-form__actions">
          <button className="secondary-button" type="button" disabled={busy} onClick={() => setPreview(null)}>
            Annulla
          </button>
          <button
            className="secondary-button"
            type="button"
            disabled={busy}
            onClick={() => preview && void commit('one', preview)}
          >
            Solo questa
          </button>
          <button
            className="primary-button"
            type="button"
            disabled={busy}
            onClick={() => preview && void commit('all', preview)}
          >
            Applica a tutte ({preview?.targets.length})
          </button>
        </div>
      </Modal>
      <Modal
        backdropClassName="creature-sheet-confirm"
        title="Modifiche non salvate"
        isOpen={closeConfirm}
        onClose={() => setCloseConfirm(false)}
      >
        <p>La bozza non è stata salvata. Puoi salvarla, continuare a modificarla o scartarla.</p>
        <button
          className="secondary-button"
          type="button"
          disabled={busy}
          onClick={() => {
            setCloseConfirm(false);
            void save();
          }}
        >
          Salva modifiche
        </button>
        <button className="secondary-button" type="button" onClick={() => setCloseConfirm(false)}>
          Continua modifica
        </button>
        <button
          className="secondary-button"
          type="button"
          onClick={() => {
            setCloseConfirm(false);
            setPortrait(undefined);
            void load();
          }}
        >
          Scarta e ricarica
        </button>
        <button className="secondary-button" type="button" onClick={onClose}>
          Scarta e chiudi
        </button>
      </Modal>
    </div>
  );
}
