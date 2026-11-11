import { describe, expect, test } from "bun:test";

import { parseConstraint, parseSingle, parseVersion } from "../src/index";

// Expected results follow composer/semver's VersionParser and Semver::satisfies.
// https://getcomposer.org/doc/articles/versions.md
// https://github.com/composer/semver/blob/3.6.0/tests/VersionParserTest.php

describe("Composer constraint syntax", () => {
  test.each([
    ["8.2.x", "8.2.10", true],
    ["8.2.X", "8.3.0", false],
    ["8.x.x", "8.4.1", true],
    ["8.*.*", "9.0.0", false],
    ["8.2.1.*", "8.2.1.5", true],
    ["8.2.1.*", "8.2.2", false],
    ["x", "8.4.1", true],
    ["X.X", "8.4.1", true],
    ["v*", "8.4.1", true],
    ["8.2.*@dev", "8.2.10", true],
    ["8.2 - 8.4", "8.2.0", true],
    ["8.2 - 8.4", "8.4.99", true],
    ["8.2 - 8.4", "8.5.0", false],
    ["8.2 - 8.4", "8.5.0-alpha1", false],
    ["7 - 8", "8.4.1", true],
    ["7 - 8", "9.0.0", false],
    ["v7 - v8", "8.4.1", true],
    ["8.2 - 8.4.0", "8.4.0", true],
    ["8.2 - 8.4.0", "8.4.1", false],
    ["8.2 - 8.4.0.1", "8.4.0.1", true],
    ["8.2 - 8.4.0.1", "8.4.0.2", false],
    ["8.2 - 8.4-stable", "8.4.0", true],
    ["8.2 - 8.4-stable", "8.4.1", false],
    ["8.2 - 8.4+metadata", "8.4.1", true],
    ["8.2 - 8.4, !=8.3.12", "8.4.1", true],
    ["8.2 - 8.4, !=8.3.12", "8.3.12", false],
    ["8.2 - 8.4 >=8.3", "8.2.10", false],
    ["8.2 - 8.4 || ^9.0", "9.0.1", true],
    [">=8.3.0RC1 <8.4", "8.3.0", true],
    [">=8.3.0RC1 <8.4", "8.4.0", false],
    ["8.3.0beta2", "8.3.0-beta2", true],
    ["^8.3.0RC1", "8.3.0", true],
    ["8.2.0 as 8.3.0", "8.2.0", true],
    ["8.2.0 as 8.3.0", "8.3.0", false],
    ["8.2.0 as 8.3.0 || ^8.4", "8.4.1", true],
    ["8.2.0 as 8.3.0, <8.3", "8.2.0", true],
    [">=8.2, <8.5", "8.4.1", true],
    [">= 8.2 < 8.4", "8.3.12", true],
    ["8.2.* | 8.4.*", "8.4.1", true],
  ])("matches %s against %s", (constraint, version, expected) => {
    expect(parseConstraint(constraint).check(parseVersion(version))).toBe(expected);
  });

  test.each([
    "",
    " ",
    "8.2 ||",
    "|| 8.2",
    "8.2 |",
    "| 8.2",
    "8.2 ||| 8.3",
    "8.2,,8.3",
    "8.2, ,8.3",
    ",8.2",
    "8.2,",
    "8.2 as",
    "8.2 -",
    "8.x - 8.4",
    "8.2 - 8.4.*",
    "8.*.2",
    "8.x.foo",
    "^8.2.*",
    "~8.2.x",
    "!=8.3.*",
    "<>8.3.x",
    "=8.*",
    "==8.*",
    ">=8.*",
    "<8.2.*",
  ])("rejects malformed constraint %s", (constraint) => {
    expect(() => parseConstraint(constraint)).toThrow();
  });

  test("parses aliases and suffixes through the single-constraint API", () => {
    expect(parseSingle("8.2.0 as 8.3.0").check(parseVersion("8.2.0"))).toBe(true);
    expect(parseSingle(">=8.3.0RC1").check(parseVersion("8.3.0"))).toBe(true);
  });
});
