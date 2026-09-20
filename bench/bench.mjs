#!/usr/bin/env node
/**
 * Fair microbench: @kleinron/ipv4 IPv4 vs ipaddr.IPv4 @ 2.5.0 (pinned oracle).
 *
 * Corpora (algo-locked):
 *   1. Strict four-part — dotted decimal 0–255, no leading zeros (+ rejects
 *      like 01.2.3.4). Races: isValidFourPartDecimal, parse.
 *   2. Loose/inet_aton — octal/hex/short/long + rejects. Races: isValid,
 *      parse, parseCIDR.
 *
 * Each corpus reports mixed / accept / reject suites.
 * % Δ only on fair same-API rows (printed after each pair).
 */

import { performance } from "node:perf_hooks";
import {
  isValidOurs,
  isValidFourPartOurs,
  parseOurs,
  parseCIDROurs,
  makeIpaddrRacers,
} from "./adapters.mjs";

// ---------------------------------------------------------------------------
// Strict four-part corpus (scan accept grammar + classic rejects)
// ---------------------------------------------------------------------------

/** @type {string[]} */
const strictAccept = [
  "0.0.0.0",
  "1.2.3.4",
  "8.8.8.8",
  "9.9.9.9",
  "10.0.0.1",
  "11.22.33.44",
  "50.50.50.50",
  "60.70.80.90",
  "100.64.0.1",
  "127.0.0.1",
  "169.254.1.1",
  "172.16.5.10",
  "192.0.2.1",
  "192.168.0.0",
  "192.168.1.1",
  "198.51.100.1",
  "203.0.113.1",
  "203.0.113.10",
  "224.0.0.1",
  "255.255.255.255",
  "1.0.0.1",
  "4.4.4.4",
  "5.6.7.8",
  "2.3.4.5",
];

/** @type {string[]} */
const strictReject = [
  "01.2.3.4",
  "00.0.0.0",
  "1.02.3.4",
  "1.2.03.4",
  "1.2.3.04",
  "001.2.3.4",
  "1.2.3",
  "1.2",
  "1",
  "1.2..4",
  "256.1.1.1",
  "1.2.3.4.5",
  "0177.0.0.1",
  "1.2.3.4/24",
  "1.2.3.4 ",
  " 1.2.3.4",
  "",
  " ",
  "1234.1.1.1",
  "0x7f.0.0.1",
  "1.2.3.400",
  "...",
  "a.b.c.d",
  "999.999.999.999",
  "1.2.3.4a",
  "1..2.3",
  ".1.2.3",
  "1.2.3.",
  "65536.0.0.1",
];

const strictMixed = [...strictAccept, ...strictReject];

// ---------------------------------------------------------------------------
// Loose / inet_aton corpus (forms ipaddr.IPv4 accepts + rejects)
// ---------------------------------------------------------------------------

/** @type {string[]} */
const looseAccept = [
  "1.2.3.4",
  "127.0.0.1",
  "192.168.1.1",
  "0.0.0.0",
  "255.255.255.255",
  "8.8.8.8",
  "01.2.3.4",
  "0177.0.0.1",
  "07.0.0.1",
  "0x7f.0.0.1",
  "0X7F.0.0.1",
  "0xff.0xff.0xff.0xff",
  "127.1",
  "127.0.1",
  "10.1",
  "1.2.3",
  "2130706433",
  "4294967295",
  "0xffffffff",
  "0x7f000001",
  "017700000001",
  "10.0xffffff",
  "1.2.0xffff",
  "00.0.0.0",
];

/** @type {string[]} */
const looseReject = [
  "",
  " ",
  "a.b.c.d",
  "...",
  "1..2.3",
  ".1.2.3",
  "1.2.3.",
  "1.2.3.4 ",
  " 1.2.3.4",
  "1.2.3.4a",
  "1.2.3.4.5",
  "256.0.0.1",
  "1.2.3.400",
  "999.999.999.999",
  "1234.1.1.1",
  "08.0.0.1",
  "09.0.0.1",
  "0x.1.1.1",
  "0xg.0.0.1",
  "4294967296",
  "0x100000000",
  "10.0x1000000",
  "1.2.0x10000",
];

const looseMixed = [...looseAccept, ...looseReject];

/** CIDR strings for parseCIDR race (loose grammar + rejects). */
/** @type {string[]} */
const cidrAccept = [
  "1.2.3.4/24",
  "192.168.1.1/0",
  "192.168.1.1/32",
  "0.0.0.0/0",
  "255.255.255.255/32",
  "10.0.0.0/8",
  "127.0.0.1/8",
  "01.2.3.4/24",
  "0177.0.0.1/16",
  "0x7f.0.0.1/16",
  "127.1/8",
  "10.1/16",
  "2130706433/32",
];

/** @type {string[]} */
const cidrReject = [
  "1.2.3.4/",
  "1.2.3.4/33",
  "1.2.3.4/-1",
  "not-an-ip/24",
  "1.2.3.4/24 ",
  "/24",
  "1.2.3.4/abc",
  "256.1.1.1/24",
  "08.0.0.1/8",
  "",
  "1.2.3.4",
  "a.b.c.d/24",
];

const cidrMixed = [...cidrAccept, ...cidrReject];

const ITERS = Number(process.env.BENCH_ITERS) || 200_000;

let ipaddrRacers = null;
try {
  const ipaddr = (await import("ipaddr.js")).default;
  ipaddrRacers = makeIpaddrRacers(ipaddr);
} catch {
  /* optional */
}

/**
 * @param {string} label
 * @param {(s: string) => unknown} fn
 * @param {string[]} C
 * @param {number} iters
 */
function bench(label, fn, C, iters) {
  let sink = 0;
  const t0 = performance.now();
  for (let i = 0; i < iters; i++) {
    for (let j = 0; j < C.length; j++) {
      const r = fn(C[j]);
      if (r === null || r === false || r === undefined) {
        sink += 1;
      } else if (typeof r === "number") {
        sink += r;
      } else if (typeof r === "boolean") {
        sink += r ? 1 : 0;
      } else if (Array.isArray(r)) {
        sink += r.length + (typeof r[1] === "number" ? r[1] : 0);
      } else if (r && typeof r === "object" && Array.isArray(r.octets)) {
        sink += r.octets[0] + r.octets[3];
      } else {
        sink += 1;
      }
    }
  }
  const t1 = performance.now();
  const elapsedSec = (t1 - t0) / 1000;
  const ops = iters * C.length;
  const nsPer = (elapsedSec * 1e9) / ops;
  const mops = ops / elapsedSec / 1e6;
  console.log(
    `${label.padEnd(52)}  ${nsPer.toFixed(2)} ns/op   ${mops.toFixed(2)} Mops/sec   (sink=${sink >>> 0})`
  );
  return { label, nsPer, mops };
}

/**
 * Fair pair: ours vs oracle; print signed % Δ (negative = ours faster).
 * @param {string} apiName
 * @param {(s: string) => unknown} oursFn
 * @param {(s: string) => unknown} theirsFn
 * @param {string[]} C
 * @param {number} iters
 */
function fairRace(apiName, oursFn, theirsFn, C, iters) {
  const ours = bench(`@kleinron/ipv4 IPv4.${apiName}`, oursFn, C, iters);
  const peer = bench(`ipaddr.IPv4.${apiName}`, theirsFn, C, iters);
  const pct = ((ours.nsPer - peer.nsPer) / peer.nsPer) * 100;
  const sign = pct > 0 ? "+" : "";
  console.log(
    `${"".padEnd(52)}  % Δ vs ipaddr.IPv4.${apiName}: ${sign}${pct.toFixed(1)}%  (neg=faster)`
  );
  return { apiName, ours, peer, pct };
}

/**
 * @param {string} title
 * @param {string[]} C
 * @param {number} iters
 * @param {"strict"|"loose"|"cidr"} kind
 */
function runSuite(title, C, iters, kind) {
  console.log(`\n=== ${title} (n=${C.length} strings × ${iters} iters) ===`);
  /** @type {ReturnType<typeof fairRace>[]} */
  const rows = [];

  if (!ipaddrRacers) {
    console.log("ipaddr.js SKIPPED (install devDependency to race)");
    return rows;
  }

  if (kind === "strict") {
    rows.push(
      fairRace(
        "isValidFourPartDecimal",
        isValidFourPartOurs,
        ipaddrRacers.isValidFourPartDecimal,
        C,
        iters
      )
    );
    rows.push(fairRace("parse", parseOurs, ipaddrRacers.parse, C, iters));
  } else if (kind === "loose") {
    rows.push(fairRace("isValid", isValidOurs, ipaddrRacers.isValid, C, iters));
    rows.push(fairRace("parse", parseOurs, ipaddrRacers.parse, C, iters));
  } else if (kind === "cidr") {
    rows.push(
      fairRace("parseCIDR", parseCIDROurs, ipaddrRacers.parseCIDR, C, iters)
    );
  }

  return rows;
}

console.log(
  "@kleinron/ipv4 fair microbench vs ipaddr.IPv4" +
    (ipaddrRacers ? " (oracle present)" : " (oracle SKIPPED)")
);
console.log("Oracle pin: ipaddr.js@2.5.0  —  https://www.npmjs.com/package/ipaddr.js");
console.log(
  "Fair races: same-API only. % Δ = (ours − peer) / peer × 100; negative = faster."
);
console.log(
  "Strict corpus → isValidFourPartDecimal + parse; loose → isValid + parse; CIDR → parseCIDR."
);

/** Collect machine-readable summary lines for RESULTS.md helpers. */
const summary = [];

function note(corpus, suite, rows) {
  for (const r of rows) {
    summary.push({
      corpus,
      suite,
      api: r.apiName,
      ours: r.ours.nsPer,
      peer: r.peer.nsPer,
      pct: r.pct,
    });
  }
}

note(
  "strict",
  "mixed",
  runSuite("STRICT four-part — mixed", strictMixed, ITERS, "strict")
);
note(
  "strict",
  "accept",
  runSuite("STRICT four-part — accept", strictAccept, ITERS, "strict")
);
note(
  "strict",
  "reject",
  runSuite("STRICT four-part — reject", strictReject, ITERS, "strict")
);

note(
  "loose",
  "mixed",
  runSuite("LOOSE/inet_aton — mixed", looseMixed, ITERS, "loose")
);
note(
  "loose",
  "accept",
  runSuite("LOOSE/inet_aton — accept", looseAccept, ITERS, "loose")
);
note(
  "loose",
  "reject",
  runSuite("LOOSE/inet_aton — reject", looseReject, ITERS, "loose")
);

note(
  "cidr",
  "mixed",
  runSuite("CIDR (loose grammar) — mixed", cidrMixed, ITERS, "cidr")
);
note(
  "cidr",
  "accept",
  runSuite("CIDR (loose grammar) — accept", cidrAccept, ITERS, "cidr")
);
note(
  "cidr",
  "reject",
  runSuite("CIDR (loose grammar) — reject", cidrReject, ITERS, "cidr")
);

console.log("\n--- SUMMARY (ns/op, % Δ vs ipaddr.IPv4.*) ---");
console.log(
  "corpus".padEnd(8) +
    "suite".padEnd(8) +
    "api".padEnd(28) +
    "ours".padStart(10) +
    "peer".padStart(10) +
    "pct".padStart(10)
);
for (const s of summary) {
  const sign = s.pct > 0 ? "+" : "";
  console.log(
    s.corpus.padEnd(8) +
      s.suite.padEnd(8) +
      s.api.padEnd(28) +
      s.ours.toFixed(1).padStart(10) +
      s.peer.toFixed(1).padStart(10) +
      `${sign}${s.pct.toFixed(1)}%`.padStart(10)
  );
}
