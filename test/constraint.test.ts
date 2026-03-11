import { describe, expect, test } from "bun:test";

import { parseConstraint, parseVersion } from "../src/index";

const mustVersion = (value: string) => parseVersion(value);
const mustConstraint = (value: string) => parseConstraint(value);

describe("wildcards", () => {
  test("matches bare wildcard", () => {
    const constraint = mustConstraint("*");
    expect(constraint.check(mustVersion("1.0.0"))).toBe(true);
    expect(constraint.check(mustVersion("1.0.0-alpha"))).toBe(true);
    expect(constraint.check(mustVersion("1.0.0-beta"))).toBe(true);
    expect(constraint.check(mustVersion("1.0.0-rc1"))).toBe(true);
  });

  test("matches major wildcards", () => {
    const constraint = mustConstraint("2.*");
    expect(constraint.check(mustVersion("2.0.0"))).toBe(true);
    expect(constraint.check(mustVersion("2.0.5"))).toBe(true);
    expect(constraint.check(mustVersion("2.1.0"))).toBe(true);
    expect(constraint.check(mustVersion("2.99.99"))).toBe(true);
    expect(constraint.check(mustVersion("1.0.0"))).toBe(false);
    expect(constraint.check(mustVersion("3.0.0"))).toBe(false);
    expect(constraint.check(mustVersion("2.0.0-alpha"))).toBe(true);
    expect(constraint.check(mustVersion("2.1.0-beta"))).toBe(true);
  });

  test("matches minor wildcards", () => {
    const constraint = mustConstraint("2.0.*");
    expect(constraint.check(mustVersion("2.0.0"))).toBe(true);
    expect(constraint.check(mustVersion("2.0.5"))).toBe(true);
    expect(constraint.check(mustVersion("2.0.99"))).toBe(true);
    expect(constraint.check(mustVersion("2.1.0"))).toBe(false);
    expect(constraint.check(mustVersion("1.0.0"))).toBe(false);
    expect(constraint.check(mustVersion("3.0.0"))).toBe(false);
    expect(constraint.check(mustVersion("2.0.0-alpha"))).toBe(true);
    expect(constraint.check(mustVersion("2.0.5-beta"))).toBe(true);
    expect(constraint.check(mustVersion("2.1.0-alpha"))).toBe(false);
  });

  test.each([
    [">= 2.*", "2.0.0", true],
    [">= 2.*", "2.1.0", true],
    [">= 2.*", "3.0.0", true],
    [">= 2.*", "1.9.9", false],
    ["< 2.*", "1.9.9", true],
    ["< 2.*", "2.0.0", false],
    ["< 2.*", "2.1.0", false],
    [">=2.* <4.*", "2.0.0", true],
    [">=2.* <4.*", "3.9.9", true],
    [">=2.* <4.*", "4.0.0", false],
    [">=2.* <4.*", "1.9.9", false],
    [">= 2.0.*", "2.0.0", true],
    [">= 2.0.*", "2.0.9", true],
    [">= 2.0.*", "2.1.0", true],
    [">= 2.0.*", "1.9.9", false],
    ["< 2.1.*", "2.0.9", true],
    ["< 2.1.*", "2.1.0", false],
    ["< 2.1.*", "2.2.0", false],
    [">=2.0.* <2.2.*", "2.0.0", true],
    [">=2.0.* <2.2.*", "2.1.9", true],
    [">=2.0.* <2.2.*", "2.2.0", false],
    [">=2.0.* <2.2.*", "1.9.9", false],
    ["2.*", "2.0.0-alpha", true],
    ["2.*", "2.1.0-beta", true],
    ["2.0.*", "2.0.0-alpha", true],
    ["2.0.*", "2.0.5-beta", true],
    ["2.0.*", "2.1.0-alpha", false],
  ])("checks wildcard constraint %s against %s", (constraint, version, expected) => {
    expect(mustConstraint(constraint).check(mustVersion(version))).toBe(expected);
  });
});

describe("constraint parsing", () => {
  test("parses valid constraints", () => {
    expect(() => mustConstraint(">=1.0.0")).not.toThrow();
    expect(() => mustConstraint(">=1.0.0 || <2.0.0")).not.toThrow();
    expect(() => mustConstraint(">=1.0.0,<2.0.0")).not.toThrow();
  });

  test("normalizes whitespace with and", () => {
    const constraint = mustConstraint(">=1.0 <2.0");
    expect(constraint.toString()).toBe(">=1.0,<2.0");
    expect(constraint.check(mustVersion("1.0.0"))).toBe(true);
    expect(constraint.check(mustVersion("2.0.0"))).toBe(false);
  });

  test("normalizes whitespace with and/or", () => {
    const constraint = mustConstraint("~6.4 >=6.4.20.0 || ~6.5");
    expect(constraint.toString()).toBe("~6.4,>=6.4.20.0||~6.5");
    expect(constraint.check(mustVersion("6.4.20"))).toBe(true);
    expect(constraint.check(mustVersion("6.4.20.0"))).toBe(true);
    expect(constraint.check(mustVersion("6.5.0"))).toBe(true);
    expect(constraint.check(mustVersion("6.4.0.0"))).toBe(false);
  });

  test("parses without whitespace", () => {
    const constraint = mustConstraint("<6.6.1.0||>=6.3.5.0");
    expect(constraint.toString()).toBe("<6.6.1.0||>=6.3.5.0");
    expect(constraint.check(mustVersion("6.4.0.0"))).toBe(true);
  });

  test("parses plain version numbers", () => {
    const constraint = mustConstraint("1.0.0");
    expect(constraint.toString()).toBe("1.0.0");
    expect(constraint.check(mustVersion("1.0.0"))).toBe(true);
    expect(constraint.check(mustVersion("1.0.1"))).toBe(false);
  });

  test("matches four-digit versions", () => {
    expect(mustConstraint("~6.5.0.0").check(mustVersion("6.5.0.0-rc1"))).toBe(true);
  });

  test.each([
    [">>1.0.0"],
    ["!1.0.0"],
    ["1.0.0-"],
    ["~>1.a.0"],
    [">=1.0.0-"],
    ["^1.0.0-"],
    ["~1.0.0-"],
  ])("rejects malformed constraint %s", (input) => {
    expect(() => mustConstraint(input)).toThrow();
  });

  test.each([
    [">=1.0.0", ">=1.0.0"],
    ["=1.0.0", "=1.0.0"],
    ["^1.0.0", "^1.0.0"],
    ["~1.0.0", "~1.0.0"],
    [">=1.0.0,<2.0.0", ">=1.0.0,<2.0.0"],
    [">=1.0.0 || <2.0.0", ">=1.0.0||<2.0.0"],
    ["v6.6.10.0", "v6.6.10.0"],
  ])("renders %s", (input, expected) => {
    expect(mustConstraint(input).toString()).toBe(expected);
  });
});

describe("constraint evaluation", () => {
  test.each([
    [">=1.0.0", "1.0.0-alpha", true],
    [">=1.0.0-alpha", "1.0.0", true],
    ["=1.0.0-alpha", "1.0.0-alpha", true],
    ["=1.0.0-alpha", "1.0.0-beta", false],
    [">=1.0.0-alpha", "1.0.0-beta", true],
    ["<=1.0.0", "1.0.0-alpha", true],
    ["^1.0.0", "1.1.0-alpha", true],
    ["~1.0.0", "1.0.1-beta", true],
  ])("checks prerelease constraint %s against %s", (constraint, version, expected) => {
    expect(mustConstraint(constraint).check(mustVersion(version))).toBe(expected);
  });

  test.each([
    ["^0.1.0", "0.1.0", true],
    ["^0.1.0", "0.2.0", true],
    ["^1.0.0", "2.0.0", false],
    ["^1.0.0", "1.9.9", true],
    ["^1.0.0-alpha", "1.0.0-beta", true],
    ["^0.0.1", "0.0.2", true],
    ["^0.0.1", "0.0.1-alpha", true],
  ])("checks caret edge case %s against %s", (constraint, version, expected) => {
    expect(mustConstraint(constraint).check(mustVersion(version))).toBe(expected);
  });

  test.each([
    ["~1.2", "1.2.0", true],
    ["~1.2", "1.3.0", true],
    ["~1.2.3", "1.2.4", true],
    ["~1.2.3", "1.3.0", false],
    ["~1.2.3-alpha", "1.2.3-beta", true],
    ["~0.1.2", "0.1.3", true],
    ["~0.1.2", "0.2.0", false],
    ["~0.1", "0.2.0", true],
    ["~1.2", "2.0.0", false],
    ["~0.1", "1.0.0", false],
    ["~6.6", "6.6.10", true],
    ["~6.6", "6.7.0", true],
    ["~6.6.0", "6.6.10", true],
    ["~6.6.0", "6.7.0", false],
  ])("checks tilde edge case %s against %s", (constraint, version, expected) => {
    expect(mustConstraint(constraint).check(mustVersion(version))).toBe(expected);
  });

  test.each([
    [">1.0.0", "1.0.1", true],
    [">1.0.0", "1.0.0", false],
    [">1.0.0", "0.9.9", false],
    ["<1.0.0", "0.9.9", true],
    ["<1.0.0", "1.0.0", false],
    ["<1.0.0", "1.0.1", false],
    ["!=1.0.0", "1.0.1", true],
    ["<>1.0.0", "1.0.1", true],
    ["!=1.0.0", "1.0.0", false],
    ["<>1.0.0", "1.0.0", false],
    [">1.0.0-alpha", "1.0.0-beta", true],
    [">1.0.0-beta", "1.0.0-alpha", false],
    ["<1.0.0-alpha", "1.0.0-beta", false],
    ["<1.0.0-beta", "1.0.0-alpha", true],
  ])("checks comparison operator %s against %s", (constraint, version, expected) => {
    expect(mustConstraint(constraint).check(mustVersion(version))).toBe(expected);
  });

  test.each([
    [">=1.0.0,<2.0.0", "1.5.0", true],
    [">=1.0.0,<2.0.0", "2.0.0", false],
    [">=1.0.0,<2.0.0", "0.9.9", false],
    [">=1.0.0 || >=3.0.0", "2.0.0", true],
    [">=1.0.0 || >=3.0.0", "3.0.0", true],
    [">=1.0.0 || >=3.0.0", "0.9.9", false],
    ["~1.2.3 || ^2.0.0", "1.2.4", true],
    ["~1.2.3 || ^2.0.0", "2.1.0", true],
    ["~1.2.3 || ^2.0.0", "1.3.0", false],
    [">=1.0.0-alpha,<2.0.0", "1.0.0-beta", true],
    [">=1.0.0-alpha,<2.0.0", "2.0.0-alpha", false],
    [">=1.0.0-alpha || >=2.0.0-alpha", "1.0.0-beta", true],
    [">=1.0.0-alpha || >=2.0.0-alpha", "2.0.0-beta", true],
  ])("checks complex constraint %s against %s", (constraint, version, expected) => {
    expect(mustConstraint(constraint).check(mustVersion(version))).toBe(expected);
  });

  test.each([
    ["1.0.0", false],
    ["1.0.0-alpha", true],
    [">=1.0.0", false],
    [">=1.0.0-alpha", true],
    ["~1.0.0-alpha", true],
    ["^1.0.0-alpha", true],
  ])("detects prerelease function for %s", (constraint, expected) => {
    expect(mustConstraint(constraint).clauses[0][0].prerelease()).toBe(expected);
  });

  test.each([
    ["==1.0.0", "1.0.0", true],
    ["==1.0.0", "1.0.1", false],
    ["==1.0.0", "0.9.9", false],
    ["==1.0.0-alpha", "1.0.0-alpha", true],
    ["==1.0.0-alpha", "1.0.0-beta", false],
    ["=1.0.0", "1.0.0", true],
    ["=1.0.0", "1.0.1", false],
    ["=1.0.0", "0.9.9", false],
    ["=1.0.0-alpha", "1.0.0-alpha", true],
    ["=1.0.0-alpha", "1.0.0-beta", false],
  ])("checks equality constraint %s against %s", (constraint, version, expected) => {
    expect(mustConstraint(constraint).check(mustVersion(version))).toBe(expected);
  });
});
