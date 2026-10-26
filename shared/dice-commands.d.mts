export function validateRollName(value: unknown): { name?: string; error?: string };
export function parseDiceCommand(value: string): {
  error?: string;
  request?: { formula: string; visibility: 'public' | 'secret'; name?: string };
};
export interface CommandHistory {
  entries: string[];
  index: number | null;
  draft: string;
}
export function createCommandHistory(): CommandHistory;
export function rememberCommand(state: CommandHistory, command: string): CommandHistory;
export function recallCommand(
  state: CommandHistory,
  direction: 'up' | 'down',
  current: string,
): { state: CommandHistory; value: string };
