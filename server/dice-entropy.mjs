import { randomBytes } from 'node:crypto';

export function nextCryptoUint32() {
  return randomBytes(4).readUInt32BE(0);
}
