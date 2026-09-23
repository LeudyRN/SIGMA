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

// Decode only complete mojibake byte sequences, preserving valid accents and
// non-Latin text surrounding them. A whole-field conversion would lose those.
export function repairTextEncoding(value) {
  let result = value;
  const byteOf = (character) => WINDOWS_1252.get(character) ?? character.codePointAt(0);
  for (let pass = 0; pass < 3; pass += 1) {
    const characters = [...result];
    let next = '';
    for (let index = 0; index < characters.length; index += 1) {
      const first = byteOf(characters[index]);
      const length =
        first >= 0xc2 && first <= 0xdf
          ? 2
          : first >= 0xe0 && first <= 0xef
            ? 3
            : first >= 0xf0 && first <= 0xf4
              ? 4
              : 0;
      const part = characters.slice(index, index + length);
      const bytes = part.map(byteOf);
      let decoded = null;
      if (
        length &&
        part.length === length &&
        bytes.slice(1).every((byte) => byte >= 0x80 && byte <= 0xbf)
      ) {
        try {
          decoded = decoder.decode(Uint8Array.from(bytes));
        } catch {
          /* Keep incomplete or invalid text unchanged. */
        }
      }
      if (decoded !== null) {
        next += decoded;
        index += length - 1;
      } else next += characters[index];
    }
    if (next === result) break;
    result = next;
  }
  return result !== value && !inspectEncoding(result) ? result : null;
}
