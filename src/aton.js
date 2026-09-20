/**
 * Regex-free loose / inet_aton scanner — identical accept set to
 * ipaddr.js@2.5.0 IPv4.parser (ipv4Part + parseIntAuto + 1/2/3/4-field pack).
 *
 * One forward pass: split on '.', classify each token as hex (0x…) /
 * octal (0[0-7]+) / decimal, then pack like the oracle.
 *
 * @param {string} string
 * @returns {number[] | null}
 */
export function parseAton(string) {
  const n = string.length;
  if (n === 0) return null;

  /** @type {number[]} */
  const vals = [];
  let i = 0;

  while (i < n) {
    if (vals.length >= 4) return null;

    const c0 = string.charCodeAt(i);

    /* hex: 0x / 0X + one or more hex digits */
    if (
      c0 === 0x30 /* 0 */ &&
      i + 1 < n &&
      (string.charCodeAt(i + 1) === 0x78 /* x */ ||
        string.charCodeAt(i + 1) === 0x58) /* X */
    ) {
      i += 2;
      let v = 0;
      let digits = 0;
      while (i < n) {
        const c = string.charCodeAt(i);
        let d;
        if (c >= 0x30 && c <= 0x39) d = c - 0x30;
        else if (c >= 0x61 && c <= 0x66) d = c - 0x61 + 10;
        else if (c >= 0x41 && c <= 0x46) d = c - 0x41 + 10;
        else break;
        v = v * 16 + d;
        digits++;
        i++;
      }
      if (digits === 0) return null;
      vals.push(v);
    } else {
      /* decimal / octal digit run — must start with 0-9 */
      if (c0 < 0x30 || c0 > 0x39) return null;
      const start = i;
      i++;
      while (i < n) {
        const c = string.charCodeAt(i);
        if (c < 0x30 || c > 0x39) break;
        i++;
      }
      vals.push(parseIntAutoDigits(string, start, i));
    }

    if (i === n) break;
    /* separator must be '.' and must not be trailing */
    if (string.charCodeAt(i) !== 0x2e /* . */) return null;
    i++;
    if (i === n) return null;
  }

  return packFields(vals);
}

/**
 * parseIntAuto on a verified digit slice [start, end).
 * Octal when leading 0 + at least one more digit; else decimal.
 * Throws if the span is empty (never silently 0); throws oracle
 * message if leading-0 field has an 8/9.
 *
 * @param {string} s
 * @param {number} start
 * @param {number} end
 */
function parseIntAutoDigits(s, start, end) {
  if (start >= end) {
    throw new Error("ipaddr: empty digit span");
  }
  const len = end - start;
  /* leading 0 and a following digit → octal path (oracle parseIntAuto) */
  if (s.charCodeAt(start) === 0x30 && len >= 2) {
    let v = 0;
    for (let k = start; k < end; k++) {
      const c = s.charCodeAt(k);
      if (c > 0x37) {
        /* 8 or 9 — oracle: throw cannot parse as octal */
        throw new Error(`ipaddr: cannot parse ${s.slice(start, end)} as octal`);
      }
      v = v * 8 + (c - 0x30);
    }
    return v;
  }
  let v = 0;
  for (let k = start; k < end; k++) {
    v = v * 10 + (s.charCodeAt(k) - 0x30);
  }
  return v;
}

/**
 * Same 1/2/3/4-field expansion + range checks as ipaddr IPv4.parser.
 * @param {number[]} vals
 * @returns {number[]}
 */
function packFields(vals) {
  const len = vals.length;
  if (len === 4) {
    return vals;
  }
  if (len === 1) {
    const value = vals[0];
    if (value > 0xffffffff || value < 0) {
      throw new Error("ipaddr: address outside defined range");
    }
    return [
      (value >>> 24) & 0xff,
      (value >>> 16) & 0xff,
      (value >>> 8) & 0xff,
      value & 0xff,
    ];
  }
  if (len === 2) {
    const value = vals[1];
    if (value > 0xffffff || value < 0) {
      throw new Error("ipaddr: address outside defined range");
    }
    return [
      vals[0],
      (value >>> 16) & 0xff,
      (value >>> 8) & 0xff,
      value & 0xff,
    ];
  }
  if (len === 3) {
    const value = vals[2];
    if (value > 0xffff || value < 0) {
      throw new Error("ipaddr: address outside defined range");
    }
    return [vals[0], vals[1], (value >>> 8) & 0xff, value & 0xff];
  }
  /* 0 fields — unreachable when n>0 and scan succeeds; keep null-safe */
  return null;
}

/**
 * Regex-free split matching oracle CIDR form (addr + slash + decimal mask): last slash, non-empty
 * address, non-empty decimal mask digits.
 *
 * @param {string} string
 * @returns {{ addr: string, mask: number } | null}
 */
export function splitCIDR(string) {
  const n = string.length;
  let slash = -1;
  for (let i = n - 1; i >= 0; i--) {
    if (string.charCodeAt(i) === 0x2f /* / */) {
      slash = i;
      break;
    }
  }
  /* need non-empty before and after */
  if (slash <= 0 || slash >= n - 1) return null;

  let mask = 0;
  for (let i = slash + 1; i < n; i++) {
    const c = string.charCodeAt(i);
    if (c < 0x30 || c > 0x39) return null;
    mask = mask * 10 + (c - 0x30);
  }
  return { addr: string.slice(0, slash), mask };
}
