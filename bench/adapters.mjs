/**
 * Bench-only adapters — NOT part of the @kleinron/ipv4 product API.
 * Fair same-API signatures vs ipaddr.IPv4 (oracle pin 2.5.0):
 *   isValid / isValidFourPartDecimal → boolean
 *   parse / parseCIDR → result | null (catch throws)
 * Not exported from package.json; not listed in files.
 */

import { IPv4 } from "../src/index.js";

/** @param {string} s */
export function isValidOurs(s) {
  return IPv4.isValid(s);
}

/** @param {string} s */
export function isValidFourPartOurs(s) {
  return IPv4.isValidFourPartDecimal(s);
}

/**
 * Loose/strict parse → IPv4 instance, or null on reject.
 * @param {string} s
 * @returns {import("../src/ipv4.js").IPv4|null}
 */
export function parseOurs(s) {
  try {
    return IPv4.parse(s);
  } catch {
    return null;
  }
}

/**
 * parseCIDR → [IPv4, prefixLength], or null on reject.
 * @param {string} s
 * @returns {[import("../src/ipv4.js").IPv4, number]|null}
 */
export function parseCIDROurs(s) {
  try {
    return IPv4.parseCIDR(s);
  } catch {
    return null;
  }
}

/**
 * Build ipaddr.js racers against the same signatures.
 * @param {import("ipaddr.js").default} ipaddr
 */
export function makeIpaddrRacers(ipaddr) {
  return {
    isValid: (s) => ipaddr.IPv4.isValid(s),
    isValidFourPartDecimal: (s) => ipaddr.IPv4.isValidFourPartDecimal(s),
    parse: (s) => {
      try {
        return ipaddr.IPv4.parse(s);
      } catch {
        return null;
      }
    },
    parseCIDR: (s) => {
      try {
        return ipaddr.IPv4.parseCIDR(s);
      } catch {
        return null;
      }
    },
  };
}
