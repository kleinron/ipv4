import { describe, it } from "node:test";
import assert from "node:assert/strict";
import ipaddr from "ipaddr.js";
import { IPv4 } from "../src/index.js";
import pkg from "../src/index.js";

/** @type {string[]} */
const CORPUS = [
  "",
  " ",
  "1",
  "1.2",
  "1.2.3",
  "1.2.3.4",
  "1.2.3.4.5",
  "01.2.3.4",
  "001.2.3.4",
  "0.0.0.0",
  "00.0.0.0",
  "127.0.0.1",
  "127.1",
  "127.0.1",
  "10.1",
  "0x7f.0.0.1",
  "0X7F.0.0.1",
  "0xff.0xff.0xff.0xff",
  "0177.0.0.1",
  "08.0.0.1",
  "09.0.0.1",
  "07.0.0.1",
  "256.0.0.1",
  "1.2.3.400",
  "999.999.999.999",
  "4294967296",
  "4294967295",
  "0xffffffff",
  "0x100000000",
  "10.0xffffff",
  "10.0x1000000",
  "1.2.0xffff",
  "1.2.0x10000",
  "a.b.c.d",
  "...",
  "1..2.3",
  ".1.2.3",
  "1.2.3.",
  "1.2.3.4 ",
  " 1.2.3.4",
  "1.2.3.4a",
  "1234.1.1.1",
  "0x.1.1.1",
  "0xg.0.0.1",
  "0x7f000001",
  "2130706433",
  "017700000001",
  "192.0.2.1",
  "255.255.255.255",
  "8.8.8.8",
  "100.64.0.1",
  "169.254.1.1",
  "10.0.0.1",
  "172.16.5.10",
  "192.168.1.1",
  "224.0.0.1",
  "1.02.3.4",
  "1.2.03.4",
  "1.2.3.04",
];

const CIDR_CORPUS = [
  "1.2.3.4/24",
  "1.2.3.4/",
  "1.2.3.4/33",
  "1.2.3.4/-1",
  "01.2.3.4/24",
  "192.168.1.1/0",
  "192.168.1.1/32",
  "127.1/8",
  "0x7f.0.0.1/16",
  "not-an-ip/24",
  "1.2.3.4/24 ",
  "/24",
];

function capture(fn) {
  try {
    return { ok: true, value: fn() };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

describe("exports", () => {
  it("named + default { IPv4 }", () => {
    assert.equal(IPv4, pkg.IPv4);
    assert.equal(typeof IPv4.parse, "function");
    assert.equal(typeof IPv4.isValidFourPartDecimal, "function");
  });
});

describe("parity vs ipaddr.IPv4 (oracle 2.5.0)", () => {
  for (const s of CORPUS) {
    it(`isValid / isValidFourPartDecimal / parse: ${JSON.stringify(s)}`, () => {
      const oursValid = capture(() => IPv4.isValid(s));
      const theirsValid = capture(() => ipaddr.IPv4.isValid(s));
      assert.equal(oursValid.ok, theirsValid.ok);
      if (oursValid.ok) assert.equal(oursValid.value, theirsValid.value);

      const oursFour = capture(() => IPv4.isValidFourPartDecimal(s));
      const theirsFour = capture(() => ipaddr.IPv4.isValidFourPartDecimal(s));
      assert.equal(oursFour.ok, theirsFour.ok);
      if (oursFour.ok) assert.equal(oursFour.value, theirsFour.value);

      const oursIsIPv4 = capture(() => IPv4.isIPv4(s));
      const theirsIsIPv4 = capture(() => ipaddr.IPv4.isIPv4(s));
      assert.equal(oursIsIPv4.ok, theirsIsIPv4.ok);
      if (oursIsIPv4.ok) {
        assert.equal(oursIsIPv4.value, theirsIsIPv4.value);
      } else {
        // Message text may differ slightly; both must throw.
        assert.equal(typeof oursIsIPv4.message, "string");
      }

      const oursParse = capture(() => IPv4.parse(s).octets);
      const theirsParse = capture(() => ipaddr.IPv4.parse(s).octets);
      assert.equal(oursParse.ok, theirsParse.ok);
      if (oursParse.ok) {
        assert.deepEqual(oursParse.value, theirsParse.value);
      }
    });
  }

  for (const s of CIDR_CORPUS) {
    it(`CIDR: ${JSON.stringify(s)}`, () => {
      assert.equal(IPv4.isValidCIDR(s), ipaddr.IPv4.isValidCIDR(s));
      assert.equal(
        IPv4.isValidCIDRFourPartDecimal(s),
        ipaddr.IPv4.isValidCIDRFourPartDecimal(s)
      );

      const ours = capture(() => {
        const c = IPv4.parseCIDR(s);
        return { octets: c[0].octets, prefix: c[1], str: c.toString() };
      });
      const theirs = capture(() => {
        const c = ipaddr.IPv4.parseCIDR(s);
        return { octets: c[0].octets, prefix: c[1], str: c.toString() };
      });
      assert.equal(ours.ok, theirs.ok);
      if (ours.ok) {
        assert.deepEqual(ours.value, theirs.value);
      }
    });
  }

  it("subnetMaskFromPrefixLength 0..32", () => {
    for (let p = 0; p <= 32; p++) {
      assert.deepEqual(
        IPv4.subnetMaskFromPrefixLength(p).octets,
        ipaddr.IPv4.subnetMaskFromPrefixLength(p).octets
      );
    }
  });

  it("network / broadcast from CIDR", () => {
    const s = "192.168.1.10/24";
    assert.equal(
      IPv4.networkAddressFromCIDR(s).toString(),
      ipaddr.IPv4.networkAddressFromCIDR(s).toString()
    );
    assert.equal(
      IPv4.broadcastAddressFromCIDR(s).toString(),
      ipaddr.IPv4.broadcastAddressFromCIDR(s).toString()
    );
  });

  it("instance: kind, toString, range, match, prefixLength, mapped", () => {
    const ours = IPv4.parse("192.0.2.1");
    const theirs = ipaddr.IPv4.parse("192.0.2.1");
    assert.equal(ours.kind(), theirs.kind());
    assert.equal(ours.toString(), theirs.toString());
    assert.equal(ours.toNormalizedString(), theirs.toNormalizedString());
    assert.deepEqual(ours.toByteArray(), theirs.toByteArray());
    assert.equal(ours.range(), theirs.range());
    assert.equal(
      ours.match(IPv4.parse("192.0.2.0"), 24),
      theirs.match(ipaddr.IPv4.parse("192.0.2.0"), 24)
    );
    assert.equal(
      ours.match([IPv4.parse("192.0.2.0"), 24]),
      theirs.match([ipaddr.IPv4.parse("192.0.2.0"), 24])
    );

    assert.equal(
      IPv4.parse("255.255.255.0").prefixLengthFromSubnetMask(),
      ipaddr.IPv4.parse("255.255.255.0").prefixLengthFromSubnetMask()
    );
    assert.equal(
      IPv4.parse("255.255.0.255").prefixLengthFromSubnetMask(),
      ipaddr.IPv4.parse("255.255.0.255").prefixLengthFromSubnetMask()
    );

    const mappedOurs = ours.toIPv4MappedAddress();
    const mappedTheirs = theirs.toIPv4MappedAddress();
    assert.equal(mappedOurs.kind(), "ipv6");
    assert.equal(mappedOurs.kind(), mappedTheirs.kind());
    assert.deepEqual(mappedOurs.parts, mappedTheirs.parts);
    assert.equal(mappedOurs.isIPv4MappedAddress(), true);
    assert.deepEqual(mappedOurs.toIPv4Address().octets, ours.octets);
  });

  it("range names for special addresses", () => {
    const samples = [
      "0.0.0.0",
      "127.0.0.1",
      "10.1.2.3",
      "172.16.5.10",
      "192.168.0.1",
      "169.254.1.1",
      "100.64.0.1",
      "224.0.0.1",
      "255.255.255.255",
      "8.8.8.8",
      "192.0.2.1",
    ];
    for (const s of samples) {
      assert.equal(IPv4.parse(s).range(), ipaddr.IPv4.parse(s).range(), s);
    }
  });
});
