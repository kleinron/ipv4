# JS bench results — 2026-09-20

Checked-in snapshot from a fresh re-run so numbers live in the repo (not only chat).

Harness: `npm run bench` from repo root (200k iters default). This directory is **not** published (`package.json` `files: ["src"]` only).

**Oracle:** [ipaddr.js](https://www.npmjs.com/package/ipaddr.js) **`2.5.0`** (pinned `devDependency`, parity oracle — never a runtime dep).

**% Δ vs peer** = `(@kleinron/ipv4 − ipaddr.IPv4) / ipaddr.IPv4 × 100`. **Negative = `@kleinron/ipv4` faster.**  
Both sides use the same call shape: boolean validators as-is; `parse` / `parseCIDR` wrapped with try/catch → `null` on reject (exception paths included in the timing).

**Parser note (this run):** shipped `src/` is **regex-free**. Loose / `inet_aton` path is a hand-written digit/base scanner (`aton.js`) with the same accept set as ipaddr.js@2.5.0; strict four-part still uses `scan.js`.

---

## Fair — strict four-part corpus

Dotted decimal `0–255` with **no leading zeros** (scan accept set) plus rejects such as `01.2.3.4`, octal/hex, short forms, junk.  
Races: `IPv4.isValidFourPartDecimal` and `IPv4.parse` vs `ipaddr.IPv4.*` (ns/op, Node 20).

### `isValidFourPartDecimal`

| Suite | `@kleinron/ipv4` | [ipaddr.js](https://www.npmjs.com/package/ipaddr.js) `IPv4.isValidFourPartDecimal` | % Δ vs peer |
|-------|-----------------:|----------------------------------------------------------------------------------:|------------:|
| mixed | 35 | 5045 | −99.3% |
| accept | 51 | 404 | −87.5% |
| reject | 24 | 9040 | −99.7% |

### `parse`

| Suite | `@kleinron/ipv4` | [ipaddr.js](https://www.npmjs.com/package/ipaddr.js) `IPv4.parse` | % Δ vs peer |
|-------|-----------------:|-----------------------------------------------------------------:|------------:|
| mixed | 1702 | 2114 | −19.5% |
| accept | 76 | 325 | −76.8% |
| reject | 2939 | 3337 | −11.9% |

---

## Fair — loose / `inet_aton` corpus

Octal / hex / 2–3-part / long forms (`0177.0.0.1`, `0x7f.0.0.1`, `127.1`, `2130706433`, …) mixed with rejects.  
Races: `IPv4.isValid` and `IPv4.parse` vs `ipaddr.IPv4.*` (ns/op, Node 20).

### `isValid`

| Suite | `@kleinron/ipv4` | [ipaddr.js](https://www.npmjs.com/package/ipaddr.js) `IPv4.isValid` | % Δ vs peer |
|-------|-----------------:|------------------------------------------------------------------:|------------:|
| mixed | 913 | 5872 | −84.5% |
| accept | 79 | 337 | −76.6% |
| reject | 1720 | 11405 | −84.9% |

### `parse`

| Suite | `@kleinron/ipv4` | [ipaddr.js](https://www.npmjs.com/package/ipaddr.js) `IPv4.parse` | % Δ vs peer |
|-------|-----------------:|-----------------------------------------------------------------:|------------:|
| mixed | 2739 | 2963 | −7.6% |
| accept | 81 | 418 | −80.5% |
| reject | 5162 | 5512 | −6.3% |

---

## Fair — `parseCIDR` (loose CIDR grammar)

CIDR strings using the same loose address grammar (`01.2.3.4/24`, `127.1/8`, `0x7f.0.0.1/16`, …) plus rejects.  
Race: `IPv4.parseCIDR` vs `ipaddr.IPv4.parseCIDR` (ns/op, Node 20).

| Suite | `@kleinron/ipv4` | [ipaddr.js](https://www.npmjs.com/package/ipaddr.js) `IPv4.parseCIDR` | % Δ vs peer |
|-------|-----------------:|--------------------------------------------------------------------:|------------:|
| mixed | 2712 | 3215 | −15.7% |
| accept | 369 | 756 | −51.1% |
| reject | 5064 | 5313 | −4.7% |

---

## Out of scope / dropped

- Dead product `check` / `parse` exports (removed in the `IPv4` drop-in); harness no longer imports them.
- `subnetMatch` not raced (optional; left out).
- Curiosity `scan_hundreds.mjs` remains on disk unused by the default harness.

---

## How to reproduce

```bash
cd <repo root>
npm install   # ipaddr.js@2.5.0 local devDependency only
npm run bench
# optional: BENCH_ITERS=200000 npm run bench
```

### Re-run environment

- Date: 2026-09-20 (IDT)
- `uname -m`: `x86_64`
- `node -v`: `v20.19.2`
- Oracle: **ipaddr.js 2.5.0**
