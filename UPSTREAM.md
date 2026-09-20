# Upstream guts map

Pure-function cores kept import-free (`scan.js` / `aton.js`) for easy upstream PR:

| ipaddr.js surface | This package |
|-------------------|--------------|
| `isValidFourPartDecimal` | `scan` |
| `IPv4.parser` | `parseAton` |
| CIDR split | `splitCIDR` |
