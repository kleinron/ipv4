import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { IPv4 } from "../src/index.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cases = JSON.parse(
  readFileSync(join(root, "fixtures", "cases.json"), "utf8")
);

describe("fixtures → isValidFourPartDecimal (strict peer grammar)", () => {
  for (const tc of cases) {
    it(`${JSON.stringify(tc.s)}`, () => {
      assert.equal(IPv4.isValidFourPartDecimal(tc.s), tc.valid);
      if (tc.valid) {
        assert.deepEqual(IPv4.parse(tc.s).octets, [
          (tc.be >>> 24) & 0xff,
          (tc.be >>> 16) & 0xff,
          (tc.be >>> 8) & 0xff,
          tc.be & 0xff,
        ]);
      }
    });
  }
});
