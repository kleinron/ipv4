/**
 * Drop-in for ipaddr.js IPv4 (MIT), parity-tested against ipaddr.js 2.5.0.
 * Strict four-part decimal is a fast path via scan() for isValidFourPartDecimal.
 * Loose / inet_aton parse is a regex-free digit/base scanner (aton.js).
 */

import { scan } from "./scan.js";
import { parseAton, splitCIDR } from "./aton.js";

function matchCIDR(first, second, partSize, cidrBits) {
  if (first.length !== second.length) {
    throw new Error("ipaddr: cannot match CIDR for objects with different lengths");
  }

  let part = 0;
  let shift;

  while (cidrBits > 0) {
    shift = partSize - cidrBits;
    if (shift < 0) {
      shift = 0;
    }

    if (first[part] >> shift !== second[part] >> shift) {
      return false;
    }

    cidrBits -= partSize;
    part += 1;
  }

  return true;
}

function subnetMatch(address, rangeList, defaultName) {
  if (defaultName === undefined || defaultName === null) {
    defaultName = "unicast";
  }

  for (const rangeName in rangeList) {
    if (Object.prototype.hasOwnProperty.call(rangeList, rangeName)) {
      let rangeSubnets = rangeList[rangeName];
      if (rangeSubnets[0] && !(rangeSubnets[0] instanceof Array)) {
        rangeSubnets = [rangeSubnets];
      }

      for (let i = 0; i < rangeSubnets.length; i++) {
        const subnet = rangeSubnets[i];
        if (address.kind() === subnet[0].kind() && address.match.apply(address, subnet)) {
          return rangeName;
        }
      }
    }
  }

  return defaultName;
}

// --- thin IPv6 (mapped only) ---------------------------------------------

/**
 * Minimal IPv6 for IPv4#toIPv4MappedAddress. Not a full dual-stack Address.
 * @param {number[]} parts
 * @param {string} [zoneId]
 */
function IPv6(parts, zoneId) {
  if (parts.length === 16) {
    this.parts = [];
    for (let i = 0; i <= 14; i += 2) {
      this.parts.push((parts[i] << 8) | parts[i + 1]);
    }
  } else if (parts.length === 8) {
    this.parts = parts;
  } else {
    throw new Error("ipaddr: ipv6 part count should be 8 or 16");
  }

  for (let i = 0; i < this.parts.length; i++) {
    const part = this.parts[i];
    if (!(0 <= part && part <= 0xffff)) {
      throw new Error("ipaddr: ipv6 part should fit in 16 bits");
    }
  }

  if (zoneId) {
    this.zoneId = zoneId;
  }
}

IPv6.prototype.kind = function () {
  return "ipv6";
};

IPv6.prototype.isIPv4MappedAddress = function () {
  return (
    this.parts[0] === 0 &&
    this.parts[1] === 0 &&
    this.parts[2] === 0 &&
    this.parts[3] === 0 &&
    this.parts[4] === 0 &&
    this.parts[5] === 0xffff
  );
};

IPv6.prototype.toIPv4Address = function () {
  if (!this.isIPv4MappedAddress()) {
    throw new Error("ipaddr: trying to convert a generic ipv6 address to ipv4");
  }
  const high = this.parts[6];
  const low = this.parts[7];
  return new IPv4([
    (high >> 8) & 0xff,
    high & 0xff,
    (low >> 8) & 0xff,
    low & 0xff,
  ]);
};

IPv6.prototype.toByteArray = function () {
  const bytes = [];
  for (let i = 0; i < this.parts.length; i++) {
    bytes.push(this.parts[i] >> 8);
    bytes.push(this.parts[i] & 0xff);
  }
  return bytes;
};

IPv6.prototype.toNormalizedString = function () {
  const addr = (() => {
    const results = [];
    for (let i = 0; i < this.parts.length; i++) {
      results.push(this.parts[i].toString(16));
    }
    return results.join(":");
  })();
  let suffix = "";
  if (this.zoneId !== undefined && this.zoneId !== null) {
    suffix = `%${this.zoneId}`;
  }
  return addr + suffix;
};

IPv6.prototype.toRFC5952String = function () {
  /* Compact longest zero run (regex-free twin of ipaddr zero-run compression). */
  const parts = this.parts;
  let bestStart = -1;
  let bestLen = 0;
  let runStart = -1;
  let runLen = 0;
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] === 0) {
      if (runStart < 0) runStart = i;
      runLen++;
      if (runLen > bestLen) {
        bestLen = runLen;
        bestStart = runStart;
      }
    } else {
      runStart = -1;
      runLen = 0;
    }
  }

  let suffix = "";
  if (this.zoneId !== undefined && this.zoneId !== null) {
    suffix = `%${this.zoneId}`;
  }

  /* ipaddr only compresses runs of length >= 2 */
  if (bestLen < 2) {
    const results = [];
    for (let i = 0; i < parts.length; i++) {
      results.push(parts[i].toString(16));
    }
    return results.join(":") + suffix;
  }

  const head = [];
  for (let i = 0; i < bestStart; i++) {
    head.push(parts[i].toString(16));
  }
  const tail = [];
  for (let i = bestStart + bestLen; i < parts.length; i++) {
    tail.push(parts[i].toString(16));
  }
  return `${head.join(":")}::${tail.join(":")}${suffix}`;
};

IPv6.prototype.toString = function () {
  return this.toRFC5952String();
};

/**
 * Only the form emitted by IPv4#toIPv4MappedAddress: ::ffff:a.b.c.d
 * (decimal octets; ffff case-insensitive). Regex-free.
 * @param {string} string
 */
IPv6.parse = function (string) {
  const n = string.length;
  /* "::ffff:" is 7 chars; need at least "::ffff:0.0.0.0" → 15 */
  if (n < 15) {
    throw new Error("ipaddr: string is not formatted like an IPv6 Address");
  }
  if (string.charCodeAt(0) !== 0x3a || string.charCodeAt(1) !== 0x3a) {
    throw new Error("ipaddr: string is not formatted like an IPv6 Address");
  }
  /* ffff case-insensitive */
  for (let k = 0; k < 4; k++) {
    const c = string.charCodeAt(2 + k);
    const want = 0x66; /* 'f' */
    if (c !== want && c !== want - 32 /* 'F' */) {
      throw new Error("ipaddr: string is not formatted like an IPv6 Address");
    }
  }
  if (string.charCodeAt(6) !== 0x3a) {
    throw new Error("ipaddr: string is not formatted like an IPv6 Address");
  }

  const octets = [0, 0, 0, 0];
  let i = 7;
  for (let oi = 0; oi < 4; oi++) {
    if (i >= n) {
      throw new Error("ipaddr: string is not formatted like an IPv6 Address");
    }
    const c0 = string.charCodeAt(i);
    if (c0 < 0x30 || c0 > 0x39) {
      throw new Error("ipaddr: string is not formatted like an IPv6 Address");
    }
    let v = c0 - 0x30;
    i++;
    while (i < n) {
      const c = string.charCodeAt(i);
      if (c < 0x30 || c > 0x39) break;
      v = v * 10 + (c - 0x30);
      i++;
    }
    octets[oi] = v;
    if (oi < 3) {
      if (i >= n || string.charCodeAt(i) !== 0x2e) {
        throw new Error("ipaddr: string is not formatted like an IPv6 Address");
      }
      i++;
    } else if (i !== n) {
      throw new Error("ipaddr: string is not formatted like an IPv6 Address");
    }
  }

  for (let j = 0; j < 4; j++) {
    if (!(0 <= octets[j] && octets[j] <= 255)) {
      throw new Error("ipaddr: ipv4 octet should fit in 8 bits");
    }
  }
  return new IPv6([
    0,
    0,
    0,
    0,
    0,
    0xffff,
    ((octets[0] << 8) | octets[1]) & 0xffff,
    ((octets[2] << 8) | octets[3]) & 0xffff,
  ]);
};

// --- IPv4 ----------------------------------------------------------------

/**
 * @param {number[]} octets
 */
export function IPv4(octets) {
  if (octets.length !== 4) {
    throw new Error("ipaddr: ipv4 octet count should be 4");
  }

  for (let i = 0; i < octets.length; i++) {
    const octet = octets[i];
    if (!(0 <= octet && octet <= 255)) {
      throw new Error("ipaddr: ipv4 octet should fit in 8 bits");
    }
  }

  this.octets = octets;
}

IPv4.prototype.SpecialRanges = {
  unspecified: [[new IPv4([0, 0, 0, 0]), 8]],
  broadcast: [[new IPv4([255, 255, 255, 255]), 32]],
  multicast: [[new IPv4([224, 0, 0, 0]), 4]],
  linkLocal: [[new IPv4([169, 254, 0, 0]), 16]],
  loopback: [[new IPv4([127, 0, 0, 0]), 8]],
  carrierGradeNat: [[new IPv4([100, 64, 0, 0]), 10]],
  private: [
    [new IPv4([10, 0, 0, 0]), 8],
    [new IPv4([172, 16, 0, 0]), 12],
    [new IPv4([192, 168, 0, 0]), 16],
  ],
  reserved: [
    [new IPv4([192, 0, 0, 0]), 24],
    [new IPv4([192, 0, 2, 0]), 24],
    [new IPv4([192, 88, 99, 0]), 24],
    [new IPv4([198, 18, 0, 0]), 15],
    [new IPv4([198, 51, 100, 0]), 24],
    [new IPv4([203, 0, 113, 0]), 24],
    [new IPv4([240, 0, 0, 0]), 4],
  ],
  as112: [
    [new IPv4([192, 175, 48, 0]), 24],
    [new IPv4([192, 31, 196, 0]), 24],
  ],
  amt: [[new IPv4([192, 52, 193, 0]), 24]],
};

IPv4.prototype.kind = function () {
  return "ipv4";
};

IPv4.prototype.match = function (other, cidrRange) {
  let ref;
  if (cidrRange === undefined) {
    ref = other;
    other = ref[0];
    cidrRange = ref[1];
  }

  if (other.kind() !== "ipv4") {
    throw new Error("ipaddr: cannot match ipv4 address with non-ipv4 one");
  }

  return matchCIDR(this.octets, other.octets, 8, cidrRange);
};

IPv4.prototype.prefixLengthFromSubnetMask = function () {
  let cidr = 0;
  let stop = false;
  const zerotable = {
    0: 8,
    128: 7,
    192: 6,
    224: 5,
    240: 4,
    248: 3,
    252: 2,
    254: 1,
    255: 0,
  };

  for (let i = 3; i >= 0; i -= 1) {
    const octet = this.octets[i];
    if (octet in zerotable) {
      const zeros = zerotable[octet];
      if (stop && zeros !== 0) {
        return null;
      }
      if (zeros !== 8) {
        stop = true;
      }
      cidr += zeros;
    } else {
      return null;
    }
  }

  return 32 - cidr;
};

IPv4.prototype.range = function () {
  return subnetMatch(this, this.SpecialRanges);
};

IPv4.prototype.toByteArray = function () {
  return this.octets.slice(0);
};

IPv4.prototype.toIPv4MappedAddress = function () {
  return IPv6.parse(`::ffff:${this.toString()}`);
};

IPv4.prototype.toNormalizedString = function () {
  return this.toString();
};

IPv4.prototype.toString = function () {
  return this.octets.join(".");
};

// --- statics -------------------------------------------------------------

IPv4.broadcastAddressFromCIDR = function (string) {
  try {
    const cidr = this.parseCIDR(string);
    const ipInterfaceOctets = cidr[0].toByteArray();
    const subnetMaskOctets = this.subnetMaskFromPrefixLength(cidr[1]).toByteArray();
    const octets = [];
    let i = 0;
    while (i < 4) {
      octets.push(
        parseInt(ipInterfaceOctets[i], 10) | (parseInt(subnetMaskOctets[i], 10) ^ 255)
      );
      i++;
    }
    return new this(octets);
  } catch (e) {
    throw new Error("ipaddr: the address does not have IPv4 CIDR format", {
      cause: e,
    });
  }
};

IPv4.isIPv4 = function (string) {
  return this.parser(string) !== null;
};

IPv4.isValid = function (string) {
  try {
    const parts = this.parser(string);
    if (parts === null) return false;
    /* Same 0..255 gate as the constructor, without allocating / throwing. */
    for (let i = 0; i < 4; i++) {
      const octet = parts[i];
      if (!(0 <= octet && octet <= 255)) return false;
    }
    return true;
  } catch {
    return false;
  }
};

IPv4.isValidCIDR = function (string) {
  try {
    this.parseCIDR(string);
    return true;
  } catch {
    return false;
  }
};

/**
 * Strict four-part decimal (no leading zeros, no loose inet_aton forms).
 * Fast path via shared branchy scanner — equivalent to the oracle's
 * isValid + strict dotted-decimal check, because every in-range four-part
 * decimal is length 7–15.
 */
IPv4.isValidFourPartDecimal = function (string) {
  if (typeof string !== "string") {
    // ipaddr: isValid catches parser throw → false before the strict check runs
    return false;
  }
  return scan(string) !== null;
};

IPv4.isValidCIDRFourPartDecimal = function (string) {
  const parts = splitCIDR(string);
  if (!this.isValidCIDR(string) || !parts) {
    return false;
  }
  return this.isValidFourPartDecimal(parts.addr);
};

IPv4.networkAddressFromCIDR = function (string) {
  try {
    const cidr = this.parseCIDR(string);
    const ipInterfaceOctets = cidr[0].toByteArray();
    const subnetMaskOctets = this.subnetMaskFromPrefixLength(cidr[1]).toByteArray();
    const octets = [];
    let i = 0;
    while (i < 4) {
      octets.push(
        parseInt(ipInterfaceOctets[i], 10) & parseInt(subnetMaskOctets[i], 10)
      );
      i++;
    }
    return new this(octets);
  } catch (e) {
    throw new Error("ipaddr: the address does not have IPv4 CIDR format", {
      cause: e,
    });
  }
};

IPv4.parse = function (string) {
  const parts = this.parser(string);
  if (parts === null) {
    throw new Error("ipaddr: string is not formatted like an IPv4 Address");
  }
  return new this(parts);
};

IPv4.parseCIDR = function (string) {
  const parts = splitCIDR(string);
  if (parts) {
    const maskLength = parts.mask;
    if (maskLength >= 0 && maskLength <= 32) {
      const parsed = [this.parse(parts.addr), maskLength];
      Object.defineProperty(parsed, "toString", {
        value: function () {
          return this.join("/");
        },
      });
      return parsed;
    }
  }
  throw new Error("ipaddr: string is not formatted like an IPv4 CIDR range");
};

/**
 * Loose / inet_aton parser — regex-free digit/base scanner with the same
 * accept set as ipaddr.js@2.5.0 IPv4.parser.
 */
IPv4.parser = function (string) {
  return parseAton(string);
};

IPv4.subnetMaskFromPrefixLength = function (prefix) {
  prefix = parseInt(prefix);
  if (Number.isNaN(prefix) || prefix < 0 || prefix > 32) {
    throw new Error("ipaddr: invalid IPv4 prefix length");
  }

  const octets = [0, 0, 0, 0];
  let j = 0;
  const filledOctetCount = Math.floor(prefix / 8);

  while (j < filledOctetCount) {
    octets[j] = 255;
    j++;
  }

  if (filledOctetCount < 4) {
    // Same expression as ipaddr.js (operator precedence intentional).
    octets[filledOctetCount] =
      (Math.pow(2, prefix % 8) - 1) << (8 - (prefix % 8));
  }

  return new this(octets);
};
