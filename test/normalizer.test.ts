import { describe, expect, test } from "bun:test";

import { normalizeBranch, normalizeVersion } from "../src/index";

describe("normalizeBranch", () => {
  test.each([
    ["v1.x", "1.9999999.9999999.9999999-dev"],
    ["v1.*", "1.9999999.9999999.9999999-dev"],
    ["v1.0", "1.0.9999999.9999999-dev"],
    ["2.0", "2.0.9999999.9999999-dev"],
    ["v1.0.x", "1.0.9999999.9999999-dev"],
    ["v1.0.3.*", "1.0.3.9999999-dev"],
    ["v2.4.0", "2.4.0.9999999-dev"],
    ["2.4.4", "2.4.4.9999999-dev"],
    ["master", "dev-master"],
    ["trunk", "dev-trunk"],
    ["feature-a", "dev-feature-a"],
    ["FOOBAR", "dev-FOOBAR"],
    ["feature+issue-1", "dev-feature+issue-1"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeBranch(input)).toBe(expected);
  });
});

describe("normalizeVersion", () => {
  test.each([
    [" 1.0.0", "1.0.0.0"],
    ["1.0.0 ", "1.0.0.0"],
    ["1.0", "1.0.0.0"],
    ["1", "1.0.0.0"],
    ["dev-master", "dev-master"],
    ["master", "dev-master"],
    ["trunk", "dev-trunk"],
    ["dev-master as 1.0.0", "dev-master"],
    ["1.0.0@dev", "1.0.0.0"],
    ["1.0.0a1", "1.0.0.0-alpha1"],
    ["1.0.0alpha1", "1.0.0.0-alpha1"],
    ["1.0.0b2", "1.0.0.0-beta2"],
    ["1.0.0beta2", "1.0.0.0-beta2"],
    ["1.0.0-a1", "1.0.0.0-alpha1"],
    ["1.0.0-alpha1", "1.0.0.0-alpha1"],
    ["1.0.0-b2", "1.0.0.0-beta2"],
    ["1.0.0-beta2", "1.0.0.0-beta2"],
    ["1.0.0a", "1.0.0.0-alpha"],
    ["1.0.0b", "1.0.0.0-beta"],
    ["1.0.0-alpha", "1.0.0.0-alpha"],
    ["1.0.0-beta", "1.0.0.0-beta"],
    ["1.0.0-a", "1.0.0.0-alpha"],
    ["1.0.0-b", "1.0.0.0-beta"],
    ["1.0.0-RC1", "1.0.0.0-rc1"],
    ["1.0.0RC1", "1.0.0.0-rc1"],
    ["1.0.0-RC2", "1.0.0.0-rc2"],
    ["1.0.0RC2", "1.0.0.0-rc2"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeVersion(input)).toBe(expected);
  });
});
