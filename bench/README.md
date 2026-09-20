# JS microbench

Fair harness: `@kleinron/ipv4` (`IPv4` drop-in) vs [ipaddr.js](https://www.npmjs.com/package/ipaddr.js) **`IPv4` @ 2.5.0** (pinned oracle).

## Run

```bash
cd <repo root>
npm install   # installs ipaddr.js **2.5.0** as a local **devDependency** only
npm run bench
```

Optional: `BENCH_ITERS=200000 npm run bench` (default 200000).

## Corpora + fair races

| Corpus | Contents | Fair races (same API both sides) |
|--------|----------|----------------------------------|
| **Strict four-part** | Dotted `0–255`, no leading zeros + rejects (`01.2.3.4`, …) | `isValidFourPartDecimal`, `parse` |
| **Loose / inet_aton** | Octal/hex/short/long + rejects | `isValid`, `parse` |
| **CIDR (loose)** | Loose-grammar CIDR + rejects | `parseCIDR` |

Each corpus reports **mixed / accept / reject**. Signed **% Δ** only on fair same-API rows (negative = `@kleinron/ipv4` faster).

## Notes

- `ipaddr.js` is a **pinned** `devDependency` (`2.5.0`) — parity oracle, never a runtime dep.
- Product API is `export { IPv4 }` / `export default { IPv4 }` (no `check` / `parse` exports).
- `parse` / `parseCIDR` adapters catch throws → `null` so reject paths are timed fairly.
- See checked-in [`RESULTS.md`](./RESULTS.md) for the latest snapshot.

Do **not** `npm publish` from bench work.
