/**
 * Shared branchy octet scanner — twin of C ipv4_scan_branchy.
 * Returns Uint8Array(4) on accept, null on reject.
 * Grammar: length 7–15, no leading zeros, ≤3 digits per octet, 0–255.
 */
export function scan(s) {
  if (typeof s !== "string") return null;
  const n = s.length;
  if (n < 7 || n > 15) return null;

  const o = new Uint8Array(4);
  let p = 0;

  for (let i = 0; i < 4; i++) {
    if (p >= n) return null;

    const c0 = s.charCodeAt(p);
    if (c0 < 0x30 || c0 > 0x39) return null;

    let v = c0 - 0x30;
    p++;
    let ndigits = 1;

    /* Leading zero ban: if first digit is 0, field must end */
    if (v === 0) {
      if (i < 3) {
        if (p >= n || s.charCodeAt(p) !== 0x2e) return null;
      } else {
        if (p !== n) return null;
      }
      o[i] = 0;
      if (i < 3) p++; /* consume '.' */
      continue;
    }

    /* Accumulate up to 2 more digits; reject 4th digit before overflow math */
    while (p < n) {
      const c = s.charCodeAt(p);
      if (c < 0x30 || c > 0x39) break;
      if (ndigits >= 3) return null;
      v = v * 10 + (c - 0x30);
      ndigits++;
      p++;
    }

    if (v > 255) return null;
    o[i] = v;

    if (i < 3) {
      if (p >= n || s.charCodeAt(p) !== 0x2e) return null;
      p++; /* consume '.' */
    } else {
      if (p !== n) return null;
    }
  }

  return o;
}

export function packBe(o) {
  return (((o[0] << 24) >>> 0) + ((o[1] << 16) >>> 0) + ((o[2] << 8) >>> 0) + (o[3] >>> 0)) >>> 0;
}

export function hasZeroByteSwar(x) {
  return (((x - 0x01010101) & ~x & 0x80808080) >>> 0) !== 0;
}
