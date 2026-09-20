# @kleinron/ipv4

**Drop-in for [`ipaddr.js`](https://www.npmjs.com/package/ipaddr.js) `IPv4`** (MIT).

Same static and instance surface as `ipaddr.IPv4`: loose / `inet_aton`-style
`parse` / `isValid` (octal, hex, short forms) via a **regex-free** digit/base
scanner, plus a **fast strict four-part** path behind `isValidFourPartDecimal`
(shared branchy scanner with the C89 peer grammar for the strict case).

Shipped `src/` contains **no `RegExp`** — accept set pinned to ipaddr.js@2.5.0.

Parity oracle: **ipaddr.js `2.5.0`** (pinned `devDependency`).

## Install

```bash
npm install @kleinron/ipv4
```

Requires Node.js >= 18.

## API

```js
import { IPv4 } from "@kleinron/ipv4";
// or: import ipv4 from "@kleinron/ipv4"; const { IPv4 } = ipv4;

IPv4.isValid("192.0.2.1");              // true
IPv4.isValid("0177.0.0.1");             // true (octal / loose)
IPv4.isValidFourPartDecimal("192.0.2.1"); // true (strict)
IPv4.isValidFourPartDecimal("0177.0.0.1"); // false

const addr = IPv4.parse("127.1");       // loose → 127.0.0.1
addr.octets;                            // [127, 0, 0, 1]
addr.toString();                        // "127.0.0.1"
addr.kind();                            // "ipv4"
addr.range();                           // "loopback"

IPv4.parseCIDR("192.168.1.10/24");
IPv4.networkAddressFromCIDR("192.168.1.10/24").toString();  // "192.168.1.0"
IPv4.broadcastAddressFromCIDR("192.168.1.10/24").toString(); // "192.168.1.255"
IPv4.subnetMaskFromPrefixLength(24).toString();              // "255.255.255.0"
```

### Statics (match `ipaddr.IPv4`)

`isIPv4`, `isValid`, `isValidCIDR`, `isValidFourPartDecimal`,
`isValidCIDRFourPartDecimal`, `parse`, `parseCIDR`, `parser`,
`subnetMaskFromPrefixLength`, `networkAddressFromCIDR`,
`broadcastAddressFromCIDR`

### Instance

`octets`, `kind`, `match`, `range`, `toString`, `toNormalizedString`,
`toByteArray`, `prefixLengthFromSubnetMask`, `toIPv4MappedAddress`,
`SpecialRanges`

Full IPv6 dual-stack `Address` is **out of scope**; only thin support for
`toIPv4MappedAddress` (`::ffff:a.b.c.d`).

## Test

```bash
npm test
```

Parity suite compares our `IPv4.*` to `ipaddr.IPv4.*` (oracle `2.5.0`) over a
corpus of valid / invalid / CIDR / loose forms. `fixtures/cases.json` drives the
strict four-part suite (shared grammar with the C89 research peer).

## Layout

- `src/ipv4.js` — `IPv4` class (drop-in)
- `src/scan.js` — strict four-part scanner (fast path)
- `src/aton.js` — loose / `inet_aton` parser + CIDR split
- `src/index.js` — `export { IPv4 }` and `export default { IPv4 }`
- `fixtures/cases.json` — strict four-part corpus
- `bench/` — dev-only harness (not published)
- `UPSTREAM.md` — guts map for upstream PR

## License

MIT
