import { useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import type {
  DndSize,
  TokenAffiliation,
  TokenCondition,
  TokenType,
  UnitToken,
  VehicleKind,
} from '../types';
import {
  gridColumnToLabel,
  gridRowToLabel,
  rowLabelToGridIndex,
} from '../utils/board';
import {
  CREATURE_CONDITIONS,
  DEFAULT_TOKEN_COLORS,
  VEHICLE_CONDITIONS,
  VEHICLE_PRESETS,
  TOKEN_COLOR_PALETTE,
  canUseCondition,
  createToken,
  defaultVehicleColor,
  sizeLabel,
  tokenGroupLabel,
  tokenTypeLabel,
} from '../utils/tokens';
import { ConditionBadge } from './ConditionBadge';
import { Modal } from './Modal';

interface NewElementModalProps {
  isOpen: boolean;
  tokens: UnitToken[];
  tokenCount: number;
  onClose: () => void;
  onAddTokens: (tokens: UnitToken[]) => void;
}

interface EditElementModalProps {
  isOpen: boolean;
  token: UnitToken | null;
  tokens: UnitToken[];
  canManageStructure?: boolean;
  canManageVisibility?: boolean;
  canRemoveToken?: boolean;
  onClose: () => void;
  onAddTokens: (tokens: UnitToken[]) => void;
  onSaveToken: (tokenId: string, updates: Partial<UnitToken>) => void;
  onSaveOwnedToken?: (
    tokenId: string,
    updates: Partial<Pick<UnitToken, 'hitPoints' | 'maxHitPoints'>>,
  ) => void;
  onRemoveToken: (tokenId: string) => void;
}

interface ElementsListModalProps {
  isOpen: boolean;
  tokens: UnitToken[];
  readOnly?: boolean;
  onClose: () => void;
  onRemoveToken: (tokenId: string) => void;
  onLocateToken: (tokenId: string) => void;
  onEditToken: (tokenId: string) => void;
}

function sizeOptions(): DndSize[] {
  return ['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan'];
}

const TOKEN_GROUP_ORDER: TokenType[] = ['player', 'enemy', 'object', 'vehicle'];

function conditionOptions(type: TokenType): TokenCondition[] {
  if (type === 'vehicle') {
    return VEHICLE_CONDITIONS;
  }

  if (type === 'player' || type === 'enemy') {
    return CREATURE_CONDITIONS;
  }

  return [];
}

function nextColor(type: TokenType, affiliation: TokenAffiliation, keepCurrent: boolean, current: string) {
  if (keepCurrent) {
    return current;
  }

  if (type === 'vehicle') {
    return defaultVehicleColor(affiliation);
  }

  return DEFAULT_TOKEN_COLORS[type];
}

function buildProgressiveName(baseName: string, index: number, total: number): string {
  return total === 1 ? baseName : `${baseName} ${index + 1}`;
}

function createEmptySeats(count: number): string[] {
  return Array.from({ length: count }, () => '');
}

function occupantOptions(tokens: UnitToken[], affiliation: TokenAffiliation, currentTokenId?: string | null) {
  return tokens.filter((token) => {
    if (token.id === currentTokenId) {
      return false;
    }

    if (token.type !== affiliation) {
      return false;
    }

    return !token.containedInVehicleId || token.containedInVehicleId === currentTokenId;
  });
}

function seatsFromOccupants(occupants: string[], capacity: number): string[] {
  return Array.from({ length: capacity }, (_, index) => occupants[index] ?? '');
}

function selectedSeatIds(seats: string[]): string[] {
  return seats.filter(Boolean);
}

function availableVehicles(
  tokens: UnitToken[],
  affiliation: TokenAffiliation,
  tokenId: string,
): UnitToken[] {
  return tokens.filter((candidate) => {
    if (candidate.type !== 'vehicle') {
      return false;
    }

    if (candidate.affiliation !== affiliation) {
      return false;
    }

    const capacity = VEHICLE_PRESETS[candidate.vehicleKind ?? 'infernal-bike'].capacity;
    const occupants = candidate.vehicleOccupantIds ?? [];
    return occupants.includes(tokenId) || occupants.length < capacity;
  });
}

function VehicleOccupantFields({
  tokens,
  affiliation,
  seats,
  currentTokenId,
  showVehicleOccupants,
  onToggleShowOccupants,
  onSeatChange,
}: {
  tokens: UnitToken[];
  affiliation: TokenAffiliation;
  seats: string[];
  currentTokenId?: string | null;
  showVehicleOccupants?: boolean;
  onToggleShowOccupants?: (checked: boolean) => void;
  onSeatChange: (index: number, value: string) => void;
}) {
  const options = occupantOptions(tokens, affiliation, currentTokenId);

  return (
    <fieldset className="token-form__fieldset">
      <legend>Occupanti</legend>
      {typeof showVehicleOccupants === 'boolean' && onToggleShowOccupants ? (
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={showVehicleOccupants}
            onChange={(event) => onToggleShowOccupants(event.target.checked)}
          />
          <span>Mostra occupanti in mappa</span>
        </label>
      ) : null}
      <div className="vehicle-seat-grid">
        {seats.map((seatValue, index) => {
          const selectedIds = new Set(selectedSeatIds(seats));
          return (
            <label key={index}>
              {`Posto ${index + 1}`}
              <select value={seatValue} onChange={(event) => onSeatChange(index, event.target.value)}>
                <option value="">Nessuno</option>
                {options
                  .filter((token) => token.id === seatValue || !selectedIds.has(token.id))
                  .map((token) => (
                    <option key={token.id} value={token.id}>
                      {token.name}
                    </option>
                  ))}
              </select>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function VehicleManagementGrid({ children }: { children: ReactNode }) {
  return <div className="vehicle-management-grid">{children}</div>;
}

function VehicleSettingsFields({
  vehicleKind,
  initiativeModifier,
  positionX,
  positionY,
  includePosition = false,
  onInitiativeModifierChange,
  onPositionXChange,
  onPositionYChange,
}: {
  vehicleKind: VehicleKind;
  initiativeModifier: number;
  positionX?: string;
  positionY?: string;
  includePosition?: boolean;
  onInitiativeModifierChange: (value: number) => void;
  onPositionXChange?: (value: string) => void;
  onPositionYChange?: (value: string) => void;
}) {
  return (
    <fieldset className="token-form__fieldset">
      <legend>Impostazioni mezzo</legend>
      <div className="vehicle-settings-row">
        <label>
          Taglia
          <select value={VEHICLE_PRESETS[vehicleKind].size} disabled>
            {sizeOptions().map((option) => (
              <option key={option} value={option}>
                {sizeLabel(option)}
              </option>
            ))}
          </select>
        </label>

        <label>
          Modificatore iniziativa
          <input
            type="number"
            value={initiativeModifier}
            onChange={(event) => onInitiativeModifierChange(Number(event.target.value) || 0)}
          />
        </label>
      </div>

      {includePosition && onPositionXChange && onPositionYChange ? (
        <div className="token-position-grid">
          <label>
            Coordinata X
            <input
              type="number"
              min="1"
              step="1"
              value={positionX}
              onChange={(event) => onPositionXChange(event.target.value)}
            />
          </label>

          <label>
            Coordinata Y
            <input
              type="text"
              value={positionY}
              onChange={(event) => onPositionYChange(event.target.value.toUpperCase())}
            />
          </label>
        </div>
      ) : null}
    </fieldset>
  );
}

function CreatureSettingsFields({
  size,
  initiativeModifier,
  positionX,
  positionY,
  onSizeChange,
  onInitiativeModifierChange,
  onPositionXChange,
  onPositionYChange,
}: {
  size: DndSize;
  initiativeModifier: number;
  positionX: string;
  positionY: string;
  onSizeChange: (size: DndSize) => void;
  onInitiativeModifierChange: (value: number) => void;
  onPositionXChange: (value: string) => void;
  onPositionYChange: (value: string) => void;
}) {
  return (
    <fieldset className="token-form__fieldset">
      <legend>Impostazioni</legend>
      <div className="vehicle-settings-row">
        <label>
          Taglia
          <select value={size} onChange={(event) => onSizeChange(event.target.value as DndSize)}>
            {sizeOptions().map((option) => (
              <option key={option} value={option}>
                {sizeLabel(option)}
              </option>
            ))}
          </select>
        </label>

        <label>
          Modificatore iniziativa
          <input
            type="number"
            value={initiativeModifier}
            onChange={(event) => onInitiativeModifierChange(Number(event.target.value) || 0)}
          />
        </label>
      </div>

      <div className="token-position-grid">
        <label>
          Coordinata X
          <input
            type="number"
            min="1"
            step="1"
            value={positionX}
            onChange={(event) => onPositionXChange(event.target.value)}
          />
        </label>

        <label>
          Coordinata Y
          <input
            type="text"
            value={positionY}
            onChange={(event) => onPositionYChange(event.target.value.toUpperCase())}
          />
        </label>
      </div>
    </fieldset>
  );
}

function ColorPaletteField({
  color,
  disabled,
  onChange,
}: {
  color: string;
  disabled?: boolean;
  onChange: (color: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (disabled) {
      setIsOpen(false);
    }
  }, [disabled]);

  return (
    <fieldset className="token-form__fieldset">
      <legend>Colore</legend>
      <div className="color-picker">
        <div className="color-picker__toolbar">
          <span className="color-picker__current">
            <span className="color-picker__swatch" style={{ backgroundColor: color }} />
            <span>{disabled ? 'Colore predefinito' : 'Colore selezionato'}</span>
          </span>

          {!disabled ? (
            <button
              type="button"
              className="color-picker__toggle"
              onClick={() => setIsOpen((current) => !current)}
              aria-expanded={isOpen}
            >
              {isOpen ? 'Chiudi' : 'Modifica'}
            </button>
          ) : null}
        </div>

        {isOpen ? (
          <div className="color-picker__dropdown">
            <div className="color-picker__grid">
              {TOKEN_COLOR_PALETTE.map((paletteColor) => (
                <button
                  key={paletteColor}
                  type="button"
                  className={`color-picker__option ${color === paletteColor ? 'color-picker__option--active' : ''}`}
                  style={{ backgroundColor: paletteColor }}
                  onClick={() => {
                    onChange(paletteColor);
                    setIsOpen(false);
                  }}
                  aria-label={`Seleziona colore ${paletteColor}`}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </fieldset>
  );
}

function TokenConditionFields({
  type,
  conditions,
  onToggle,
}: {
  type: TokenType;
  conditions: TokenCondition[];
  onToggle: (condition: TokenCondition) => void;
}) {
  const options = conditionOptions(type);
  if (options.length === 0) {
    return null;
  }

  return (
    <fieldset className="token-form__fieldset">
      <legend>Condizioni</legend>
      <div className="condition-toggle-grid">
        {options.map((condition) => {
          const active = conditions.includes(condition);
          return (
            <label key={condition} className={`condition-toggle ${active ? 'condition-toggle--active' : ''}`}>
              <input
                type="checkbox"
                checked={active}
                onChange={() => onToggle(condition)}
              />
              <ConditionBadge condition={condition} />
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function NewElementModal({
  isOpen,
  tokens,
  tokenCount,
  onClose,
  onAddTokens,
}: NewElementModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<TokenType>('player');
  const [size, setSize] = useState<DndSize>('medium');
  const [quantity, setQuantity] = useState(1);
  const [color, setColor] = useState(DEFAULT_TOKEN_COLORS.player);
  const [initiativeModifier, setInitiativeModifier] = useState(0);
  const [vehicleKind, setVehicleKind] = useState<VehicleKind>('infernal-bike');
  const [vehicleAffiliation, setVehicleAffiliation] = useState<TokenAffiliation>('player');
  const [showVehicleOccupants, setShowVehicleOccupants] = useState(true);
  const [vehicleSeats, setVehicleSeats] = useState<string[]>(() =>
    createEmptySeats(VEHICLE_PRESETS['infernal-bike'].capacity),
  );
  const [newEnemyName, setNewEnemyName] = useState('Nemico');
  const [newEnemyQuantity, setNewEnemyQuantity] = useState(1);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (type === 'vehicle') {
      setSize(VEHICLE_PRESETS[vehicleKind].size);
      setColor(defaultVehicleColor(vehicleAffiliation));
      return;
    }

    setColor(DEFAULT_TOKEN_COLORS[type]);
  }, [isOpen, type, vehicleAffiliation, vehicleKind]);

  useEffect(() => {
    if (type !== 'vehicle') {
      return;
    }

    setVehicleSeats((current) => seatsFromOccupants(current.filter(Boolean), VEHICLE_PRESETS[vehicleKind].capacity));
  }, [type, vehicleKind]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const baseName = type === 'vehicle' ? VEHICLE_PRESETS[vehicleKind].label : name.trim();
    const normalizedQuantity = type === 'vehicle' ? 1 : Math.max(1, Math.floor(quantity) || 1);
    if (!baseName) {
      return;
    }

    const createdTokens = Array.from({ length: normalizedQuantity }, (_, index) => {
      const tokenName = normalizedQuantity === 1 ? baseName : `${baseName} ${index + 1}`;
      const tokenType = type;
      const tokenAffiliation =
        tokenType === 'vehicle'
          ? vehicleAffiliation
          : tokenType === 'player' || tokenType === 'enemy'
            ? tokenType
            : null;

      return createToken(
        tokenName,
        tokenType,
        tokenType === 'vehicle' ? VEHICLE_PRESETS[vehicleKind].size : size,
        tokenCount + index,
        tokenType === 'vehicle' ? defaultVehicleColor(vehicleAffiliation) : color,
        tokenType === 'object' ? 0 : initiativeModifier,
        tokenAffiliation,
        tokenType === 'vehicle' ? vehicleKind : null,
      );
    });

    if (type === 'vehicle') {
      const selectedOccupantIds = selectedSeatIds(vehicleSeats);
      const createdEnemies: UnitToken[] = [];

      if (vehicleAffiliation === 'enemy') {
        const enemyBaseName = newEnemyName.trim();
        const availableSeats = Math.max(0, VEHICLE_PRESETS[vehicleKind].capacity - selectedOccupantIds.length);
        const enemyCount = Math.min(
          availableSeats,
          Math.max(0, Math.floor(newEnemyQuantity) || 0),
        );

        if (enemyCount > 0 && enemyBaseName) {
          for (let index = 0; index < enemyCount; index += 1) {
            const enemyToken = createToken(
              buildProgressiveName(enemyBaseName, index, enemyCount),
              'enemy',
              'medium',
              tokenCount + createdTokens.length + createdEnemies.length + index,
              DEFAULT_TOKEN_COLORS.enemy,
              initiativeModifier,
              'enemy',
              null,
            );
            createdEnemies.push(enemyToken);
          }
        }
      }

      const occupantIds = [...selectedOccupantIds, ...createdEnemies.map((token) => token.id)];
      const nextTokens = [...createdTokens, ...createdEnemies].map((token) => {
        if (token.type === 'vehicle') {
          return {
            ...token,
            vehicleOccupantIds: occupantIds,
            showVehicleOccupants,
          };
        }

        if (occupantIds.includes(token.id)) {
          return {
            ...token,
            containedInVehicleId: createdTokens[0]?.id ?? null,
          };
        }

        return token;
      });

      onAddTokens(nextTokens);
    } else {
      onAddTokens(createdTokens);
    }

    setName('');
    setType('player');
    setSize('medium');
    setQuantity(1);
    setColor(DEFAULT_TOKEN_COLORS.player);
    setInitiativeModifier(0);
    setVehicleKind('infernal-bike');
    setVehicleAffiliation('player');
    setShowVehicleOccupants(true);
    setVehicleSeats(createEmptySeats(VEHICLE_PRESETS['infernal-bike'].capacity));
    setNewEnemyName('Nemico');
    setNewEnemyQuantity(1);
    onClose();
  };

  return (
    <Modal title="Nuovo elemento" isOpen={isOpen} onClose={onClose}>
      <form className="token-form" onSubmit={handleSubmit}>
        <label>
          Tipo
          <select value={type} onChange={(event) => setType(event.target.value as TokenType)}>
            <option value="player">PG</option>
            <option value="enemy">Nemico</option>
            <option value="object">Oggetto</option>
            <option value="vehicle">Mezzo</option>
          </select>
        </label>

        {type === 'vehicle' ? (
          <>
            <label>
              Mezzo
              <select
                value={vehicleKind}
                onChange={(event) => {
                  const nextVehicleKind = event.target.value as VehicleKind;
                  setVehicleKind(nextVehicleKind);
                  setSize(VEHICLE_PRESETS[nextVehicleKind].size);
                }}
              >
                {Object.entries(VEHICLE_PRESETS).map(([value, preset]) => (
                  <option key={value} value={value}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Associato a
              <select
                value={vehicleAffiliation}
                onChange={(event) => {
                  const nextAffiliation = event.target.value as TokenAffiliation;
                  setVehicleAffiliation(nextAffiliation);
                  setColor(defaultVehicleColor(nextAffiliation));
                  setVehicleSeats(createEmptySeats(VEHICLE_PRESETS[vehicleKind].capacity));
                }}
              >
                <option value="player">PG</option>
                <option value="enemy">Nemici</option>
              </select>
            </label>

            {vehicleAffiliation === 'enemy' ? (
              <VehicleManagementGrid>
                <VehicleOccupantFields
                  tokens={tokens}
                  affiliation={vehicleAffiliation}
                  seats={vehicleSeats}
                  showVehicleOccupants={showVehicleOccupants}
                  onToggleShowOccupants={setShowVehicleOccupants}
                  onSeatChange={(index, value) => {
                    setVehicleSeats((current) => current.map((seat, seatIndex) => (seatIndex === index ? value : seat)));
                  }}
                />
                <div className="vehicle-management-column">
                  <fieldset className="token-form__fieldset">
                    <legend>Crea nemici nel mezzo</legend>
                    <div className="vehicle-seat-grid">
                      <label>
                        Nome base
                        <input
                          type="text"
                          value={newEnemyName}
                          onChange={(event) => setNewEnemyName(event.target.value)}
                          placeholder="Es. Diavolo della strada"
                        />
                      </label>
                      <label>
                        Quantita
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={newEnemyQuantity}
                          onChange={(event) => setNewEnemyQuantity(Number(event.target.value))}
                        />
                      </label>
                    </div>
                  </fieldset>
                  <VehicleSettingsFields
                    vehicleKind={vehicleKind}
                    initiativeModifier={initiativeModifier}
                    onInitiativeModifierChange={setInitiativeModifier}
                  />
                </div>
              </VehicleManagementGrid>
            ) : (
              <>
                <VehicleOccupantFields
                  tokens={tokens}
                  affiliation={vehicleAffiliation}
                  seats={vehicleSeats}
                  showVehicleOccupants={showVehicleOccupants}
                  onToggleShowOccupants={setShowVehicleOccupants}
                  onSeatChange={(index, value) => {
                    setVehicleSeats((current) => current.map((seat, seatIndex) => (seatIndex === index ? value : seat)));
                  }}
                />
                <VehicleSettingsFields
                  vehicleKind={vehicleKind}
                  initiativeModifier={initiativeModifier}
                  onInitiativeModifierChange={setInitiativeModifier}
                />
              </>
            )}
          </>
        ) : (
          <label>
            Nome
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Es. Diavolo spinato"
            />
          </label>
        )}

        {type !== 'vehicle' ? (
          <label>
            Taglia
            <select
              value={size}
              onChange={(event) => setSize(event.target.value as DndSize)}
            >
              {sizeOptions().map((option) => (
                <option key={option} value={option}>
                  {sizeLabel(option)}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label>
          Quantita
          <input
            type="number"
            min="1"
            step="1"
            value={type === 'vehicle' ? 1 : quantity}
            disabled={type === 'vehicle'}
            onChange={(event) => setQuantity(Number(event.target.value))}
          />
        </label>

        <ColorPaletteField
          color={type === 'vehicle' ? defaultVehicleColor(vehicleAffiliation) : color}
          disabled={type === 'vehicle'}
          onChange={setColor}
        />

        {type !== 'object' && type !== 'vehicle' ? (
          <label>
            Modificatore iniziativa
            <input
              type="number"
              value={initiativeModifier}
              onChange={(event) => setInitiativeModifier(Number(event.target.value) || 0)}
            />
          </label>
        ) : null}

        <button type="submit">Aggiungi</button>
      </form>
    </Modal>
  );
}

export function EditElementModal({
  isOpen,
  token,
  tokens,
  canManageStructure = true,
  canManageVisibility = true,
  canRemoveToken = true,
  onClose,
  onAddTokens,
  onSaveToken,
  onSaveOwnedToken,
  onRemoveToken,
}: EditElementModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<TokenType>('player');
  const [size, setSize] = useState<DndSize>('medium');
  const [positionX, setPositionX] = useState('1');
  const [positionY, setPositionY] = useState('A');
  const [color, setColor] = useState(DEFAULT_TOKEN_COLORS.player);
  const [initiativeModifier, setInitiativeModifier] = useState(0);
  const [vehicleKind, setVehicleKind] = useState<VehicleKind>('infernal-bike');
  const [vehicleAffiliation, setVehicleAffiliation] = useState<TokenAffiliation>('player');
  const [showVehicleOccupants, setShowVehicleOccupants] = useState(true);
  const [vehicleSeats, setVehicleSeats] = useState<string[]>(() =>
    createEmptySeats(VEHICLE_PRESETS['infernal-bike'].capacity),
  );
  const [containedVehicleId, setContainedVehicleId] = useState('');
  const [newEnemyName, setNewEnemyName] = useState('Nemico');
  const [newEnemyQuantity, setNewEnemyQuantity] = useState(0);
  const [conditions, setConditions] = useState<TokenCondition[]>([]);
  const [hitPoints, setHitPoints] = useState('');
  const [maxHitPoints, setMaxHitPoints] = useState('');
  const [hitPointDelta, setHitPointDelta] = useState('0');
  const [isInvisible, setIsInvisible] = useState(false);

  useEffect(() => {
    if (!token) {
      return;
    }

    setName(token.name);
    setType(token.type);
    setSize(token.size);
    setPositionX(gridColumnToLabel(token.position.x));
    setPositionY(gridRowToLabel(token.position.y));
    setColor(token.color);
    setInitiativeModifier(token.initiativeModifier);
    setVehicleKind(token.vehicleKind ?? 'infernal-bike');
    setVehicleAffiliation(token.affiliation === 'enemy' ? 'enemy' : 'player');
    setShowVehicleOccupants(token.showVehicleOccupants ?? true);
    setVehicleSeats(
      seatsFromOccupants(
        token.type === 'vehicle' ? token.vehicleOccupantIds ?? [] : [],
        VEHICLE_PRESETS[token.vehicleKind ?? 'infernal-bike'].capacity,
      ),
    );
    setContainedVehicleId(token.containedInVehicleId ?? '');
    setNewEnemyName('Nemico');
    setNewEnemyQuantity(0);
    setConditions(token.conditions);
    setHitPoints(token.hitPoints !== null && token.hitPoints !== undefined ? String(token.hitPoints) : '');
    setMaxHitPoints(token.maxHitPoints !== null && token.maxHitPoints !== undefined ? String(token.maxHitPoints) : '');
    setHitPointDelta('0');
    setIsInvisible(token.isInvisible === true);
  }, [token]);

  const compatibleVehicles = useMemo(() => {
    if (!token || (type !== 'player' && type !== 'enemy')) {
      return [];
    }

    return availableVehicles(tokens, type, token.id);
  }, [token, tokens, type]);

  if (!token) {
    return null;
  }

  const currentVehicle =
    containedVehicleId
      ? tokens.find((item) => item.id === containedVehicleId && item.type === 'vehicle') ?? null
      : null;

  const handleConditionToggle = (condition: TokenCondition) => {
    setConditions((current) =>
      current.includes(condition)
        ? current.filter((item) => item !== condition)
        : [...current, condition],
    );
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const parsedHitPoints =
      hitPoints.trim() === '' ? null : Number.isFinite(Number(hitPoints)) ? Number(hitPoints) : null;
    const parsedMaxHitPoints =
      maxHitPoints.trim() === '' ? null : Number.isFinite(Number(maxHitPoints)) ? Number(maxHitPoints) : null;
    const delta = Number.isFinite(Number(hitPointDelta)) ? Number(hitPointDelta) : 0;

    if (!canManageStructure) {
      const nextBaseHitPoints =
        parsedHitPoints ?? token.hitPoints ?? 0;
      onSaveOwnedToken?.(token.id, {
        hitPoints: nextBaseHitPoints + delta,
        maxHitPoints: parsedMaxHitPoints,
      });
      onClose();
      return;
    }

    const nextHitPoints =
      parsedHitPoints === null ? null : parsedHitPoints + delta;

    const nextName = type === 'vehicle' ? VEHICLE_PRESETS[vehicleKind].label : name.trim();
    if (!nextName) {
      return;
    }

    const nextAffiliation =
      type === 'vehicle'
        ? vehicleAffiliation
        : type === 'player' || type === 'enemy'
          ? type
          : null;
    const nextConditions = conditions.filter((condition) => canUseCondition(type, condition));
    const nextColor = type === 'vehicle' ? defaultVehicleColor(vehicleAffiliation) : color;
    const occupantIds = type === 'vehicle' ? selectedSeatIds(vehicleSeats) : [];

    if (type === 'vehicle' && vehicleAffiliation === 'enemy') {
      const enemyBaseName = newEnemyName.trim();
      const availableSeats = Math.max(0, VEHICLE_PRESETS[vehicleKind].capacity - occupantIds.length);
      const enemyCount = Math.min(availableSeats, Math.max(0, Math.floor(newEnemyQuantity) || 0));

      if (enemyBaseName && enemyCount > 0) {
        const createdEnemies = Array.from({ length: enemyCount }, (_, index) =>
          createToken(
            buildProgressiveName(enemyBaseName, index, enemyCount),
            'enemy',
            'medium',
            tokens.length + index,
            DEFAULT_TOKEN_COLORS.enemy,
            initiativeModifier,
            'enemy',
            null,
          ),
        ).map((enemyToken) => ({
          ...enemyToken,
          containedInVehicleId: token.id,
        }));

        occupantIds.push(...createdEnemies.map((enemyToken) => enemyToken.id));
        onAddTokens(createdEnemies);
      }
    }

    if (type === 'player' || type === 'enemy') {
      const previousVehicleId = token.containedInVehicleId ?? '';
      const nextVehicleId = containedVehicleId;

      if (previousVehicleId && previousVehicleId !== nextVehicleId) {
        const previousVehicle = tokens.find((item) => item.id === previousVehicleId && item.type === 'vehicle');
        if (previousVehicle) {
          onSaveToken(previousVehicle.id, {
            vehicleOccupantIds: (previousVehicle.vehicleOccupantIds ?? []).filter((occupantId) => occupantId !== token.id),
          });
        }
      }

      if (nextVehicleId && previousVehicleId !== nextVehicleId) {
        const nextVehicle = tokens.find((item) => item.id === nextVehicleId && item.type === 'vehicle');
        if (nextVehicle) {
          onSaveToken(nextVehicle.id, {
            vehicleOccupantIds: [...(nextVehicle.vehicleOccupantIds ?? []), token.id],
          });
        }
      }
    }

    onSaveToken(token.id, {
      name: nextName,
      type,
      size: type === 'vehicle' ? VEHICLE_PRESETS[vehicleKind].size : size,
      position: {
        x: Math.max(0, (Math.floor(Number(positionX)) || 1) - 1),
        y: rowLabelToGridIndex(positionY),
      },
      color: nextColor,
      initiativeModifier: type === 'object' ? 0 : initiativeModifier,
      affiliation: nextAffiliation,
      vehicleKind: type === 'vehicle' ? vehicleKind : null,
      vehicleOccupantIds: type === 'vehicle' ? occupantIds : [],
      showVehicleOccupants: type === 'vehicle' ? showVehicleOccupants : undefined,
      containedInVehicleId:
        type === 'vehicle'
          ? null
          : type === 'player' || type === 'enemy'
            ? containedVehicleId || null
            : null,
      hitPoints: nextHitPoints,
      maxHitPoints: parsedMaxHitPoints,
      isInvisible,
      conditions: nextConditions,
    });
    onClose();
  };

  return (
    <Modal title={`Modifica ${token.name}`} isOpen={isOpen} onClose={onClose}>
      <form className="token-form" onSubmit={handleSubmit}>
        <label>
          Tipo
          <select
            value={type}
            onChange={(event) => {
              const nextType = event.target.value as TokenType;
              setType(nextType);
              setConditions((current) => current.filter((condition) => canUseCondition(nextType, condition)));
              if (nextType === 'vehicle') {
                setVehicleAffiliation(token.affiliation === 'enemy' ? 'enemy' : 'player');
                setColor(defaultVehicleColor(token.affiliation === 'enemy' ? 'enemy' : 'player'));
                setContainedVehicleId('');
              } else {
                setColor(nextColor(nextType, vehicleAffiliation, false, color));
                if (nextType === 'player' || nextType === 'enemy') {
                  const currentContainer = tokens.find((item) => item.id === containedVehicleId);
                  if (currentContainer?.affiliation !== nextType) {
                    setContainedVehicleId('');
                  }
                }
              }
            }}
          >
            <option value="player">PG</option>
            <option value="enemy">Nemico</option>
            <option value="object">Oggetto</option>
            <option value="vehicle">Mezzo</option>
          </select>
        </label>

        {type === 'vehicle' ? (
          <>
            <label>
              Mezzo
              <select
                value={vehicleKind}
                onChange={(event) => {
                  const nextVehicleKind = event.target.value as VehicleKind;
                  setVehicleKind(nextVehicleKind);
                  setSize(VEHICLE_PRESETS[nextVehicleKind].size);
                  setName(VEHICLE_PRESETS[nextVehicleKind].label);
                  setVehicleSeats((current) =>
                    seatsFromOccupants(current.filter(Boolean), VEHICLE_PRESETS[nextVehicleKind].capacity),
                  );
                }}
              >
                {Object.entries(VEHICLE_PRESETS).map(([value, preset]) => (
                  <option key={value} value={value}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Associato a
              <select
                value={vehicleAffiliation}
                onChange={(event) => {
                  const nextAffiliation = event.target.value as TokenAffiliation;
                  setVehicleAffiliation(nextAffiliation);
                  setColor(defaultVehicleColor(nextAffiliation));
                  setVehicleSeats(createEmptySeats(VEHICLE_PRESETS[vehicleKind].capacity));
                }}
              >
                <option value="player">PG</option>
                <option value="enemy">Nemici</option>
              </select>
            </label>

            {vehicleAffiliation === 'enemy' ? (
              <VehicleManagementGrid>
                <VehicleOccupantFields
                  tokens={tokens}
                  affiliation={vehicleAffiliation}
                  seats={vehicleSeats}
                  currentTokenId={token.id}
                  showVehicleOccupants={showVehicleOccupants}
                  onToggleShowOccupants={setShowVehicleOccupants}
                  onSeatChange={(index, value) => {
                    setVehicleSeats((current) => current.map((seat, seatIndex) => (seatIndex === index ? value : seat)));
                  }}
                />
                <div className="vehicle-management-column">
                  <fieldset className="token-form__fieldset">
                    <legend>Aggiungi nuovi nemici</legend>
                    <div className="vehicle-seat-grid">
                      <label>
                        Nome base
                        <input
                          type="text"
                          value={newEnemyName}
                          onChange={(event) => setNewEnemyName(event.target.value)}
                          placeholder="Es. Diavolo della strada"
                        />
                      </label>
                      <label>
                        Quantita
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={newEnemyQuantity}
                          onChange={(event) => setNewEnemyQuantity(Number(event.target.value))}
                        />
                      </label>
                    </div>
                  </fieldset>
                  <VehicleSettingsFields
                    vehicleKind={vehicleKind}
                    initiativeModifier={initiativeModifier}
                    positionX={positionX}
                    positionY={positionY}
                    includePosition
                    onInitiativeModifierChange={setInitiativeModifier}
                    onPositionXChange={setPositionX}
                    onPositionYChange={setPositionY}
                  />
                </div>
              </VehicleManagementGrid>
            ) : (
              <>
                <VehicleOccupantFields
                  tokens={tokens}
                  affiliation={vehicleAffiliation}
                  seats={vehicleSeats}
                  currentTokenId={token.id}
                  showVehicleOccupants={showVehicleOccupants}
                  onToggleShowOccupants={setShowVehicleOccupants}
                  onSeatChange={(index, value) => {
                    setVehicleSeats((current) => current.map((seat, seatIndex) => (seatIndex === index ? value : seat)));
                  }}
                />
                <VehicleSettingsFields
                  vehicleKind={vehicleKind}
                  initiativeModifier={initiativeModifier}
                  positionX={positionX}
                  positionY={positionY}
                  includePosition
                  onInitiativeModifierChange={setInitiativeModifier}
                  onPositionXChange={setPositionX}
                  onPositionYChange={setPositionY}
                />
              </>
            )}

            <p className="form-hint">
              Gli occupanti selezionati salgono sul mezzo; rimuovendoli dai posti tornano sganciati.
            </p>
          </>
        ) : (
          <>
            <label>
              Nome
              <input type="text" value={name} onChange={(event) => setName(event.target.value)} />
            </label>

            {type === 'player' || type === 'enemy' ? (
              <VehicleManagementGrid>
                <fieldset className="token-form__fieldset">
                  <legend>Gruppo</legend>
                  <label>
                    Mezzo
                    <select
                      value={containedVehicleId}
                      onChange={(event) => setContainedVehicleId(event.target.value)}
                    >
                      <option value="">A piedi</option>
                      {compatibleVehicles.map((vehicle) => (
                        <option key={vehicle.id} value={vehicle.id}>
                          {vehicle.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="form-hint">
                    Seleziona un mezzo per agganciare il token. Usa "A piedi" per sganciarlo e farlo scendere.
                  </p>
                  <div className="token-form__actions">
                    <button
                      type="button"
                      className="secondary-button secondary-button--small"
                      disabled={compatibleVehicles.length === 0}
                      onClick={() => {
                        if (!containedVehicleId && compatibleVehicles[0]) {
                          setContainedVehicleId(compatibleVehicles[0].id);
                        }
                      }}
                    >
                      Fai salire
                    </button>
                    <button
                      type="button"
                      className="outline-button"
                      disabled={!containedVehicleId}
                      onClick={() => setContainedVehicleId('')}
                    >
                      Scendi dal mezzo
                    </button>
                  </div>
                  {currentVehicle ? (
                    <p className="form-hint">
                      Attualmente su: <strong>{currentVehicle.name}</strong>
                    </p>
                  ) : null}
                </fieldset>

                <CreatureSettingsFields
                  size={size}
                  initiativeModifier={initiativeModifier}
                  positionX={positionX}
                  positionY={positionY}
                  onSizeChange={setSize}
                  onInitiativeModifierChange={setInitiativeModifier}
                  onPositionXChange={setPositionX}
                  onPositionYChange={setPositionY}
                />
              </VehicleManagementGrid>
            ) : null}
          </>
        )}

        {type !== 'vehicle' && type !== 'player' && type !== 'enemy' ? (
          <>
            <label>
              Taglia
              <select
                value={size}
                onChange={(event) => setSize(event.target.value as DndSize)}
              >
                {sizeOptions().map((option) => (
                  <option key={option} value={option}>
                    {sizeLabel(option)}
                  </option>
                ))}
              </select>
            </label>

            <div className="token-position-grid">
              <label>
                Coordinata X
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={positionX}
                  onChange={(event) => setPositionX(event.target.value)}
                />
              </label>

              <label>
                Coordinata Y
                <input type="text" value={positionY} onChange={(event) => setPositionY(event.target.value.toUpperCase())} />
              </label>
            </div>
          </>
        ) : null}

        <p className="form-hint">
          X usa i numeri delle colonne, Y usa le lettere delle righe. Per elementi piu grandi di 1 casella, le coordinate indicano l’angolo in alto a sinistra.
        </p>

        <ColorPaletteField
          color={type === 'vehicle' ? defaultVehicleColor(vehicleAffiliation) : color}
          disabled={type === 'vehicle'}
          onChange={setColor}
        />

        {type !== 'object' && type !== 'vehicle' && type !== 'player' && type !== 'enemy' ? (
          <label>
            Modificatore iniziativa
            <input
              type="number"
              value={initiativeModifier}
              onChange={(event) => setInitiativeModifier(Number(event.target.value) || 0)}
            />
          </label>
        ) : null}

        <fieldset className="token-form__fieldset">
          <legend>Punti ferita</legend>
          <div className="vehicle-settings-row">
            <label>
              PF attuali
              <input type="number" value={hitPoints} onChange={(event) => setHitPoints(event.target.value)} />
            </label>
            <label>
              PF massimi
              <input type="number" value={maxHitPoints} onChange={(event) => setMaxHitPoints(event.target.value)} />
            </label>
          </div>
          <label>
            Modifica rapida
            <input
              type="number"
              value={hitPointDelta}
              onChange={(event) => setHitPointDelta(event.target.value)}
            />
          </label>
        </fieldset>

        {canManageVisibility ? (
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={isInvisible}
              onChange={(event) => setIsInvisible(event.target.checked)}
            />
            <span>Invisibile per gli altri player</span>
          </label>
        ) : null}

        <TokenConditionFields type={type} conditions={conditions} onToggle={handleConditionToggle} />

        <div className="token-form__actions">
          <button type="submit">Salva modifiche</button>
          {canRemoveToken ? (
            <button
              type="button"
              className="danger-button"
              onClick={() => {
                onRemoveToken(token.id);
                onClose();
              }}
            >
              Rimuovi elemento
            </button>
          ) : null}
        </div>
      </form>
    </Modal>
  );
}

export function ElementsListModal({
  isOpen,
  tokens,
  readOnly = false,
  onClose,
  onRemoveToken,
  onLocateToken,
  onEditToken,
}: ElementsListModalProps) {
  const [priorityType, setPriorityType] = useState<TokenType>('player');
  const groupedTokens = useMemo(() => {
    const groups = new Map<TokenType, UnitToken[]>();

    tokens.forEach((token) => {
      const current = groups.get(token.type) ?? [];
      current.push(token);
      groups.set(token.type, current);
    });

    return Array.from(groups.entries()).sort(([a], [b]) => {
      if (a === priorityType) {
        return -1;
      }

      if (b === priorityType) {
        return 1;
      }

      return TOKEN_GROUP_ORDER.indexOf(a) - TOKEN_GROUP_ORDER.indexOf(b);
    });
  }, [priorityType, tokens]);

  return (
    <Modal title="Elementi in mappa" isOpen={isOpen} onClose={onClose}>
      <div className="token-groups">
        <div className="token-filter-bar">
          {TOKEN_GROUP_ORDER.map((type) => (
            <button
              key={type}
              type="button"
              className={`token-filter-chip ${priorityType === type ? 'token-filter-chip--active' : ''}`}
              onClick={() => setPriorityType(type)}
            >
              <span className={`token-filter-chip__dot token-filter-chip__dot--${type}`} />
              <span>{tokenGroupLabel(type)}</span>
            </button>
          ))}
        </div>

        {groupedTokens.map(([type, group]) => (
          <section key={type} className="token-group">
            <div className="token-group__header">
              <h3>{tokenGroupLabel(type)}</h3>
              <span>{group.length}</span>
            </div>

            <ul className="token-list">
              {group.map((token) => (
                <li key={token.id}>
                  <span className={`token-badge token-badge--${token.type}`}>{tokenTypeLabel(token.type)}</span>
                  <div className="token-list__meta">
                    <span>
                      <button
                        type="button"
                        className="token-name-button"
                        onClick={() => {
                          onLocateToken(token.id);
                          onClose();
                        }}
                      >
                        {token.name}
                      </button>
                    </span>
                    <span className="token-size">{sizeLabel(token.size)}</span>
                    {token.conditions.length > 0 ? (
                      <span className="condition-badge-list">
                        {token.conditions.map((condition) => (
                          <ConditionBadge key={condition} condition={condition} />
                        ))}
                      </span>
                    ) : null}
                  </div>
                  <span className="token-coords">
                    ({gridColumnToLabel(token.position.x)}, {gridRowToLabel(token.position.y)})
                  </span>
                  <div className="token-list__actions">
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => {
                        onLocateToken(token.id);
                        onClose();
                      }}
                      aria-label={`Localizza ${token.name}`}
                      title={`Localizza ${token.name}`}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          d="M1.5 12s3.8-6.5 10.5-6.5S22.5 12 22.5 12 18.7 18.5 12 18.5 1.5 12 1.5 12Z"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                        />
                        <circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
                      </svg>
                    </button>
                    {!readOnly ? (
                      <>
                        <button type="button" className="secondary-button secondary-button--small" onClick={() => onEditToken(token.id)}>
                          Modifica
                        </button>
                        <button type="button" className="danger-button" onClick={() => onRemoveToken(token.id)}>
                          Rimuovi
                        </button>
                      </>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Modal>
  );
}
