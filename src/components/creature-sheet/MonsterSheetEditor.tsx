import { abilityModifier } from '../../../shared/dnd-rules';
import {
  MONSTER_FIELDS,
  MONSTER_COLLECTIONS,
  MONSTER_ACTION_FIELDS,
  type MonsterData,
  type MonsterAction,
} from '../../../shared/creature-sheet-data.mjs';
import { SheetField, SheetPanel } from '../character-sheet/SheetPrimitives';
export function MonsterSheetEditor({
  data,
  onChange,
  onRoll,
}: {
  data: MonsterData;
  onChange: (data: MonsterData) => void;
  onRoll: (target: string) => void;
}) {
  const abilities = new Set(['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma']);
  const set = (key: string, value: string) => onChange({ ...data, [key]: value });
  return (
    <div className="character-sheet-page monster-stat-block">
      <h3>Blocco statistiche · Mostro</h3>
      <p>Statistiche 5e · compilazione manuale</p>
      <div className="monster-stat-block__fields">
        {MONSTER_FIELDS.filter(([key]) => !abilities.has(key)).map(([key, label]) => (
          <SheetField
            key={key}
            label={label}
            value={typeof data[key] === 'string' ? (data[key] as string) : ''}
            multiline={['notes', 'legendaryDescription'].includes(key)}
            onChange={(value) => set(key, value)}
          />
        ))}
      </div>
      <SheetPanel title="Caratteristiche">
        <div className="monster-stat-block__abilities">
          {MONSTER_FIELDS.filter(([key]) => abilities.has(key)).map(([key, label]) => {
            const score = typeof data[key] === 'string' ? (data[key] as string) : '';
            const modifier = abilityModifier(score);
            return (
              <div key={key}>
                <SheetField label={label} value={score} onChange={(value) => set(key, value)} />
                <output aria-label={`Modificatore ${label}`}>
                  {modifier === null ? '—' : modifier >= 0 ? `+${modifier}` : modifier}
                </output>
              </div>
            );
          })}
        </div>
      </SheetPanel>
      {MONSTER_COLLECTIONS.map(([collection, label]) => {
        const rows = data[collection] as MonsterAction[];
        return (
          <SheetPanel key={collection} title={label}>
            {rows.map((row) => (
              <div key={row.id} className="monster-stat-block__action">
                <div className="monster-stat-block__fields">
                  {MONSTER_ACTION_FIELDS.map(([key, fieldLabel]) => (
                    <SheetField
                      key={key}
                      label={fieldLabel}
                      value={row[key as keyof MonsterAction]}
                      multiline={key === 'description'}
                      onChange={(value) =>
                        onChange({
                          ...data,
                          [collection]: rows.map((r) => (r.id === row.id ? { ...r, [key]: value } : r)),
                        })
                      }
                    />
                  ))}
                </div>
                <div className="token-form__actions">
                  {collection !== 'traits' && row.attackBonus.trim() ? (
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => onRoll(`${collection}:${row.id}:attack`)}
                    >
                      Tira attacco
                    </button>
                  ) : null}
                  {collection !== 'traits' && row.damageFormula.trim() ? (
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => onRoll(`${collection}:${row.id}:damage`)}
                    >
                      Tira danno
                    </button>
                  ) : null}
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => onChange({ ...data, [collection]: rows.filter((r) => r.id !== row.id) })}
                  >
                    Rimuovi {row.name || 'voce'}
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                onChange({
                  ...data,
                  [collection]: [
                    ...rows,
                    {
                      id: crypto.randomUUID(),
                      ...Object.fromEntries(MONSTER_ACTION_FIELDS.map(([key]) => [key, ''])),
                    } as MonsterAction,
                  ],
                })
              }
            >
              Aggiungi a {label.toLowerCase()}
            </button>
          </SheetPanel>
        );
      })}
    </div>
  );
}
