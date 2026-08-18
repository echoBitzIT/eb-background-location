/** Mint a UUID v4-style id for field location points (no extra dependency). */
export function createPointUuid(): string {
  const cryptoObj = (
    globalThis as {
      crypto?: {
        randomUUID?: () => string;
        getRandomValues?: (array: Uint8Array) => Uint8Array;
      };
    }
  ).crypto;

  if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
    return cryptoObj.randomUUID();
  }

  if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    cryptoObj.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const n = (Math.random() * 16) | 0;
    const v = char === 'x' ? n : (n & 0x3) | 0x8;
    return v.toString(16);
  });
}
