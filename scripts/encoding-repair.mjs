// Inverse of UTF-8 mistakenly decoded as Windows-1252 or ISO-8859-1.
// Never guess missing bytes (replacement characters or question marks).
const WINDOWS_1252 = new Map(
  [...'€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008dŽ\u008f\u0090‘’“”•–—˜™š›œ\u009džŸ'].map((character, index) => [
    character,
    index + 0x80,
  ]),
);
const decoder = new TextDecoder('utf-8', { fatal: true });
const markerCount = (value) => (value.match(/[ÃÂâð�]/gu) ?? []).length;

export function inspectEncoding(value) {
  return /[ÃÂâð�]/u.test(value);
}

export function repairEncoding(value) {
  let result = value;
  for (let pass = 0; pass < 3 && inspectEncoding(result); pass += 1) {
    const bytes = [];
    for (const character of result) {
      const point = character.codePointAt(0);
      const byte = WINDOWS_1252.get(character) ?? (point <= 255 ? point : null);
      if (byte === null) return null;
      bytes.push(byte);
    }
    let candidate;
    try {
      candidate = decoder.decode(Uint8Array.from(bytes));
    } catch {
      break;
    }
    if (markerCount(candidate) >= markerCount(result)) break;
    result = candidate;
  }
  return result === value || inspectEncoding(result) ? null : result;
}
