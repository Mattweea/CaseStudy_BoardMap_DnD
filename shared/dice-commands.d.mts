export function validateRollName(value: unknown): { name?: string; error?: string };
export function parseDiceCommand(value: string): {
  error?: string;
  request?: { formula: string; visibility: 'public' | 'secret'; name?: string };
};
