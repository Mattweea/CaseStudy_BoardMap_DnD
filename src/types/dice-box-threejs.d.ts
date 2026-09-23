declare module '@3d-dice/dice-box-threejs' {
  export interface DiceBoxOptions {
    assetPath?: string;
    sounds?: boolean;
    shadows?: boolean;
    theme_surface?: string;
    theme_colorset?: string;
    theme_texture?: string;
    theme_material?: 'none' | 'metal' | 'wood' | 'glass' | 'plastic';
    gravity_multiplier?: number;
    light_intensity?: number;
    baseScale?: number;
    strength?: number;
  }

  export default class DiceBox {
    constructor(selector: string, options?: DiceBoxOptions);
    initialize(): Promise<void>;
    roll(notation: string): Promise<unknown>;
    clearDice(): void;
    // Esposto dalla libreria per il polling dello stato di quiete dei corpi fisici.
    readonly diceList?: Array<{ body?: { sleepState?: number } }>;
    setDimensions(): void;
  }
}
