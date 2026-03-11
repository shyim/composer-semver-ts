import { describe, expect, test } from "bun:test";

import { parseConstraint, parseVersion, sortVersions } from "../src/index";

const mustVersion = (value: string) => parseVersion(value);
const mustConstraint = (value: string) => parseConstraint(value);

describe("version parsing and normalization", () => {
  test("parses branch versions that end with -dev", () => {
    const version = mustVersion("6.5.x-dev");
    expect(version.normalizedString()).toBe("6.5.9999999.9999999-dev");
    expect(mustConstraint("~6.5.0").check(version)).toBe(true);
  });

  test.each([
    ["1.2.3", "1.2.3.0", false],
    ["v1.2.3", "1.2.3.0", false],
    ["1.2", "1.2.0.0", false],
    ["1", "1.0.0.0", false],
    ["1.2.3-beta", "1.2.3.0-beta", false],
    ["1.2.3+build", "1.2.3.0", false],
    ["1.2.3-beta+build", "1.2.3.0-beta", false],
    ["1.2.3.4", "1.2.3.4", false],
    ["1.2.3.4-beta", "1.2.3.4-beta", false],
    ["1.2.3.4+build", "1.2.3.4", false],
    ["v1.2.3.4-beta+build", "1.2.3.4-beta", false],
    ["1.2.3-beta.2", "1.2.3.0-beta2", false],
    ["1.2.3+build.123", "1.2.3.0", false],
    ["", "", true],
    ["invalid", "", true],
    ["1.invalid", "", true],
    ["1.2.invalid", "", true],
    ["1.2.3-", "", true],
    ["1.2.3+", "", true],
  ])("handles version %s", (input, expected, shouldFail) => {
    if (shouldFail) {
      expect(() => parseVersion(input)).toThrow();
      return;
    }

    expect(mustVersion(input).normalizedString()).toBe(expected);
  });

  test.each([
    ["1.2.3", "1.2.3.0"],
    ["1.2-beta", "1.2.0.0-beta"],
  ])("normalizes %s to %s", (input, expected) => {
    const version = mustVersion(input);
    expect(version.normalizedString()).toBe(expected);
    expect(version.original()).toBe(input);
  });
});

describe("version comparisons", () => {
  test.each([
    ["1.2.3", "1.4.5", false],
    ["1.2-beta", "1.2-beta", true],
    ["1.2", "1.1.4", false],
    ["1.2", "1.2-beta", false],
    ["1.2+foo", "1.2+beta", true],
    ["v1.2", "v1.2-beta", false],
    ["v1.2+foo", "v1.2+beta", true],
    ["v1.2.3.4", "v1.2.3.4", true],
    ["v1.2.0.0", "v1.2", true],
    ["v1.2", "v1.2.0.0", true],
    ["v1.2.0.0", "v1.2.0.1", false],
    ["v1.2.3.0", "v1.2.3.4", false],
    ["1.7-rc2", "1.7-rc1", false],
    ["1.7-rc2", "1.7", false],
  ])("%s equals %s", (left, right, expected) => {
    expect(mustVersion(left).equal(mustVersion(right))).toBe(expected);
  });

  test.each([
    ["1.2.3", "1.4.5", false],
    ["1.2-beta", "1.2-beta", false],
    ["1.2", "1.1.4", true],
    ["1.2", "1.2-beta", true],
    ["1.2+foo", "1.2+beta", false],
    ["v1.2", "v1.2-beta", true],
    ["v1.2+foo", "v1.2+beta", false],
    ["v1.2.3.4", "v1.2.3.4", false],
    ["v1.2.0.0", "v1.2", false],
    ["v1.2.0.1", "v1.2", true],
    ["v1.2", "v1.2.0.0", false],
    ["v1.2", "v1.2.0.1", false],
    ["v1.2.0.0", "v1.2.0.1", false],
    ["v1.2.3.0", "v1.2.3.4", false],
    ["1.7-rc2", "1.7-rc1", true],
    ["1.7-rc2", "1.7", false],
  ])("%s is greater than %s", (left, right, expected) => {
    expect(mustVersion(left).greaterThan(mustVersion(right))).toBe(expected);
  });

  test.each([
    ["1.2.3", "1.4.5", true],
    ["1.2-beta", "1.2-beta", false],
    ["1.2", "1.1.4", false],
    ["1.2", "1.2-beta", false],
    ["1.2+foo", "1.2+beta", false],
    ["v1.2", "v1.2-beta", false],
    ["v1.2+foo", "v1.2+beta", false],
    ["v1.2.3.4", "v1.2.3.4", false],
    ["v1.2.0.0", "v1.2", false],
    ["v1.2", "v1.2.0.0", false],
    ["v1.2", "v1.2.0.1", true],
    ["v1.2.0.0", "v1.2.0.1", true],
    ["v1.2.3.0", "v1.2.3.4", true],
    ["1.7-rc2", "1.7-rc1", false],
    ["1.7-rc2", "1.7", true],
  ])("%s is less than %s", (left, right, expected) => {
    expect(mustVersion(left).lessThan(mustVersion(right))).toBe(expected);
  });

  test.each([
    ["1.2.3", "1.4.5", false],
    ["1.2-beta", "1.2-beta", true],
    ["1.2", "1.1.4", true],
    ["1.2", "1.2-beta", true],
    ["1.2+foo", "1.2+beta", true],
    ["v1.2", "v1.2-beta", true],
    ["v1.2+foo", "v1.2+beta", true],
    ["v1.2.3.4", "v1.2.3.4", true],
    ["v1.2.0.0", "v1.2", true],
    ["v1.2.0.1", "v1.2", true],
    ["v1.2", "v1.2.0.0", true],
    ["v1.2", "v1.2.0.1", false],
    ["v1.2.0.0", "v1.2.0.1", false],
    ["v1.2.3.0", "v1.2.3.4", false],
    ["1.7-rc2", "1.7-rc1", true],
    ["1.7-rc2", "1.7", false],
  ])("%s is greater than or equal to %s", (left, right, expected) => {
    expect(mustVersion(left).greaterThanOrEqual(mustVersion(right))).toBe(expected);
  });

  test.each([
    ["1.2.3", "1.4.5", true],
    ["1.2-beta", "1.2-beta", true],
    ["1.2", "1.1.4", false],
    ["1.2", "1.2-beta", false],
    ["1.2+foo", "1.2+beta", true],
    ["v1.2", "v1.2-beta", false],
    ["v1.2+foo", "v1.2+beta", true],
    ["v1.2.3.4", "v1.2.3.4", true],
    ["v1.2.0.0", "v1.2", true],
    ["v1.2", "v1.2.0.0", true],
    ["v1.2.0.1", "v1.2", false],
    ["v1.2", "v1.2.0.1", true],
    ["v1.2.0.0", "v1.2.0.1", true],
    ["v1.2.3.0", "v1.2.3.4", true],
    ["1.7-rc2", "1.7-rc1", false],
    ["1.7-rc2", "1.7", true],
  ])("%s is less than or equal to %s", (left, right, expected) => {
    expect(mustVersion(left).lessThanOrEqual(mustVersion(right))).toBe(expected);
  });

  test.each([
    ["1.2.3-alpha", "1.2.3-alpha", 0],
    ["1.2.3-alpha1", "1.2.3-alpha2", -1],
    ["1.2.3-alpha2", "1.2.3-alpha1", 1],
    ["1.2.3-alpha", "1.2.3-beta", -1],
    ["1.2.3-beta", "1.2.3-alpha", 1],
    ["1.2.3-alpha", "1.2.3", -1],
    ["1.2.3", "1.2.3-alpha", 1],
    ["1.2.3-rc1", "1.2.3-rc2", -1],
    ["1.2.3-rc2", "1.2.3-rc1", 1],
    ["1.2.3-rc1", "1.2.3-rc10", -1],
    ["1.2.3-rc10", "1.2.3-rc1", 1],
  ])("compares prerelease %s to %s", (left, right, expected) => {
    expect(mustVersion(left).compare(mustVersion(right))).toBe(expected);
  });

  test.each([
    ["1.2.3", "1.2.3", 0],
    ["1.2.3", "1.2.4", -1],
    ["1.2.4", "1.2.3", 1],
    ["1.2.3", "1.3.0", -1],
    ["1.3.0", "1.2.3", 1],
    ["1.2.3", "2.0.0", -1],
    ["2.0.0", "1.2.3", 1],
    ["1.2.3.0", "1.2.3", 0],
    ["1.2.3.1", "1.2.3", 1],
    ["1.2.3", "1.2.3.1", -1],
    ["1.2.3.4", "1.2.3.4", 0],
    ["1.2.3.4", "1.2.3.5", -1],
    ["1.2.3.5", "1.2.3.4", 1],
  ])("compares segments %s to %s", (left, right, expected) => {
    expect(mustVersion(left).compare(mustVersion(right))).toBe(expected);
  });
});

describe("version utilities", () => {
  test("sorts versions", () => {
    const versions = [
      mustVersion("6.5.0.0-rc2"),
      mustVersion("6.3.1.0"),
      mustVersion("6.5.0.0-rc1"),
      mustVersion("6.2.0"),
      mustVersion("6.4.8.0"),
      mustVersion("6.5.0.0"),
    ];

    sortVersions(versions);

    expect(versions.map((version) => version.normalizedString())).toEqual([
      "6.2.0.0",
      "6.3.1.0",
      "6.4.8.0",
      "6.5.0.0-rc1",
      "6.5.0.0-rc2",
      "6.5.0.0",
    ]);
  });

  test("increments version segments", () => {
    const version = mustVersion("1.2.3.0");
    version.increasePatch();
    expect(version.normalizedString()).toBe("1.2.4.0");
    version.increaseMinor();
    expect(version.normalizedString()).toBe("1.3.0.0");
    version.increaseMajor();
    expect(version.normalizedString()).toBe("2.0.0.0");
  });

  test.each([
    ["1.2.3", [1, 2, 3, 0], [1, 2, 3, 0], "1.2.3"],
    ["v1.2.3.4", [1, 2, 3, 4], [1, 2, 3, 4], "v1.2.3.4"],
    ["1.2", [1, 2, 0, 0], [1, 2, 0, 0], "1.2"],
    ["1", [1, 0, 0, 0], [1, 0, 0, 0], "1"],
  ])("returns segments for %s", (input, expected, expected64, original) => {
    const version = mustVersion(input);
    expect(version.segments()).toEqual(expected);
    expect(version.segments64()).toEqual(expected64);
    expect(version.original()).toBe(original);
  });

  test.each([
    ["1.2.3", "", "", false],
    ["1.2.3+build", "", "", false],
    ["1.2.3-beta", "", "beta", true],
    ["1.2.3-beta+build", "", "beta", true],
    ["1.2.3+build.1", "", "", false],
    ["1.2.3-beta1+build.1", "", "beta1", true],
    ["1.2.3-alpha1+build.123.4", "", "alpha1", true],
  ])(
    "returns metadata and prerelease for %s",
    (input, metadata, prerelease, expectedPrerelease) => {
      const version = mustVersion(input);
      expect(version.metadata()).toBe(metadata);
      expect(version.prerelease()).toBe(prerelease);
      expect(version.isPrerelease()).toBe(expectedPrerelease);
    },
  );

  test.each([
    [
      "1.2.3",
      "2.0.0.0",
      "1.3.0.0",
      "1.2.4.0",
      [1, 2, 3, 0],
      [2, 0, 0, 0],
      [1, 3, 0, 0],
      [1, 2, 4, 0],
    ],
    [
      "1.2.3.4",
      "2.0.0.0",
      "1.3.0.0",
      "1.2.4.0",
      [1, 2, 3, 4],
      [2, 0, 0, 0],
      [1, 3, 0, 0],
      [1, 2, 4, 0],
    ],
    [
      "0.1.2",
      "1.0.0.0",
      "0.2.0.0",
      "0.1.3.0",
      [0, 1, 2, 0],
      [1, 0, 0, 0],
      [0, 2, 0, 0],
      [0, 1, 3, 0],
    ],
  ])(
    "updates segments correctly for %s",
    (
      input,
      afterMajor,
      afterMinor,
      afterPatch,
      startSegments,
      majorSegments,
      minorSegments,
      patchSegments,
    ) => {
      let version = mustVersion(input);
      expect(version.segments64()).toEqual(startSegments);
      version.increaseMajor();
      expect(version.segments64()).toEqual(majorSegments);
      expect(version.normalizedString()).toBe(afterMajor);

      version = mustVersion(input);
      version.increaseMinor();
      expect(version.segments64()).toEqual(minorSegments);
      expect(version.normalizedString()).toBe(afterMinor);

      version = mustVersion(input);
      version.increasePatch();
      expect(version.segments64()).toEqual(patchSegments);
      expect(version.normalizedString()).toBe(afterPatch);
    },
  );

  test("returns major, minor and patch", () => {
    const version = mustVersion("5.2.3");
    expect(version.major()).toBe(5);
    expect(version.minor()).toBe(2);
    expect(version.patch()).toBe(3);
  });
});

describe("constraint interaction", () => {
  test("matches rc with tilde", () => {
    const versions = [mustVersion("6.4.4.0"), mustVersion("6.5.0.0-rc1")];
    const constraint = mustConstraint("~6.5.0");
    const match = versions.find((version) => constraint.check(version));
    expect(match?.normalizedString()).toBe("6.5.0.0-rc1");
  });

  test.each(["^6.5", "^6.5.0", ">=6.5"])("matches rc with %s", (input) => {
    const versions = [mustVersion("6.4.4.0"), mustVersion("6.5.0.0-rc1")];
    const constraint = mustConstraint(input);
    const match = versions.find((version) => constraint.check(version));
    expect(match?.normalizedString()).toBe("6.5.0.0-rc1");
  });

  test("supports caret constraints", () => {
    const constraint = mustConstraint("^6.4.0");
    expect(constraint.check(mustVersion("6.3.0.0"))).toBe(false);
    expect(constraint.check(mustVersion("6.4.0.0"))).toBe(true);
    expect(constraint.check(mustVersion("6.4.0.1"))).toBe(true);
    expect(constraint.check(mustVersion("6.4.1.0"))).toBe(true);
    expect(constraint.check(mustVersion("6.4.5.0"))).toBe(true);
    expect(constraint.check(mustVersion("6.5.5.5"))).toBe(true);
    expect(constraint.check(mustVersion("6.9.9.9"))).toBe(true);
    expect(constraint.check(mustVersion("7.0.0"))).toBe(false);
  });

  test("supports version constraints without operators", () => {
    const constraint = mustConstraint("6.4.0.0");
    expect(constraint.check(mustVersion("6.3.0.0"))).toBe(false);
    expect(constraint.check(mustVersion("6.4.0.0"))).toBe(true);
    expect(constraint.check(mustVersion("6.5.0.0"))).toBe(false);
  });

  test.each([
    ["= 1.0", false],
    ["= 1.0-beta", true],
    ["~> 2.1.0", false],
    ["~> 2.1.0-dev", true],
    ["> 2.0", false],
    [">= 2.1.0-alpha", true],
  ])("detects prerelease constraints for %s", (input, expected) => {
    expect(mustConstraint(input).clauses[0][0].prerelease()).toBe(expected);
  });
});
