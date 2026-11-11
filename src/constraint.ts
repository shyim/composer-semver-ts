import { cloneForComparison, parseVersion, Version } from "./version";

type ConstraintFn = (version: Version, check: Version | null, originalSegments: number) => boolean;

const stabilityLevels = new Map([
  ["dev", 0],
  ["alpha", 1],
  ["beta", 2],
  ["rc", 3],
  ["stable", 4],
]);

const operatorHandlers = new Map<string, ConstraintFn>([
  ["", constraintEqual],
  ["=", constraintEqual],
  ["==", constraintEqual],
  ["!=", constraintNotEqual],
  ["<>", constraintNotEqual],
  [">", constraintGreaterThan],
  ["<", constraintLessThan],
  [">=", constraintGreaterThanEqual],
  ["<=", constraintLessThanEqual],
  ["~>", constraintPessimistic],
  ["^", constraintCaret],
  ["~", constraintTilde],
]);

const constraintRegexp = new RegExp(
  String.raw`^\s*(==|!=|<>|>=|<=|~>|=|>|<|\^|~|)\s*(v?[0-9xX*]+(?:\.[0-9xX*]+)*(?:-?[A-Za-z][0-9A-Za-z.-]*)?(?:\+[^\s,@]+)?)(?:@([A-Za-z]+))?\s*$`,
  "i",
);

export class Constraint {
  fn: ConstraintFn;

  operator: string;
  originalSegments: number;
  originalValue: string;
  stability: string;
  version: Version | null;

  constructor({
    fn,
    operator,
    originalSegments,
    originalValue,
    stability,
    version,
  }: {
    fn: ConstraintFn;
    operator: string;
    originalSegments: number;
    originalValue: string;
    stability: string;
    version: Version | null;
  }) {
    this.fn = fn;
    this.operator = operator;
    this.originalSegments = originalSegments;
    this.originalValue = originalValue;
    this.stability = stability;
    this.version = version;
  }

  check(version: Version): boolean {
    if (this.stability) {
      const minimum = stabilityLevels.get(this.stability) ?? -1;
      const current = stabilityLevels.get(getVersionStability(version)) ?? -1;
      if (minimum > current) {
        return false;
      }
    }

    return this.fn(version, this.version, this.originalSegments);
  }

  prerelease(): boolean {
    return Boolean(this.version?.prerelease());
  }

  toString(): string {
    return this.originalValue;
  }
}

export class Constraints {
  clauses: Constraint[][];

  constructor(clauses: Constraint[][]) {
    this.clauses = clauses;
  }

  check(version: Version): boolean {
    return this.clauses.some((group) => group.every((constraint) => constraint.check(version)));
  }

  toString(): string {
    return this.clauses.map((group) => group.map(String).join(",")).join("||");
  }
}

export function parseConstraint(input: string): Constraints {
  const groups = input.trim().split(/\s*\|\|?\s*/).map(parseConstraintGroup);
  return new Constraints(groups);
}

export function parseSingle(input: string): Constraint {
  const value = input.trim().replace(/^([^,\s]+) +as +([^,\s]+)$/, "$1");
  const match = value.match(constraintRegexp);
  if (!match) {
    throw new Error(`malformed constraint: ${input}`);
  }

  const [, operator, versionText, stabilityText = ""] = match;
  const stability = stabilityText.toLowerCase();

  if (stability && !stabilityLevels.has(stability)) {
    throw new Error(`unknown stability: ${stability}`);
  }

  if (/^[v\d.xX*]+$/i.test(versionText) && /[xX*]/.test(versionText)) {
    return parseWildcardConstraint({ operator, originalValue: input, stability, versionText });
  }

  const fn = operatorHandlers.get(operator);
  if (!fn) {
    throw new Error(`malformed constraint: ${input}`);
  }

  return new Constraint({
    fn,
    operator,
    originalSegments: versionText.replace(/^v/i, "").split(/[^\d.]/, 1)[0].split(".").length,
    originalValue: input,
    stability,
    version: parseVersion(versionText),
  });
}

function parseConstraintGroup(input: string): Constraint[] {
  // Keep operator spaces, aliases and hyphen ranges together, as Composer does.
  // Empty clauses and repeated separators must reach parseSingle and fail.
  // Separator grammar: composer/semver's VersionParser::parseConstraints (MIT).
  const tokens = input.split(/(?<!^|as|[=>< ,]) *(?<!-)[, ](?!-) *(?!,|as|$)/);
  return tokens.flatMap((token) => {
    const hyphen = token.match(/^(\S+) +- +(\S+)$/);
    if (!hyphen) {
      return [parseSingle(token)];
    }

    const [, from, to] = hyphen;
    // Explicit patches/suffixes are inclusive; partial numeric upper bounds
    // include every version in the named major or minor.
    const partial = to.match(/^v?(\d+)(?:\.(\d+))?(?:\+[^\s]+)?$/i);
    if (!partial) {
      return [parseSingle(`>=${from}`), parseSingle(`<=${to}`)];
    }
    parseVersion(to);
    const upper =
      partial[2] === undefined
        ? `${Number(partial[1]) + 1}.0.0`
        : `${partial[1]}.${Number(partial[2]) + 1}.0`;
    return [parseSingle(`>=${from}`), parseSingle(`<${upper}-dev`)];
  });
}

function parseWildcardConstraint({
  operator,
  originalValue,
  stability,
  versionText,
}: {
  operator: string;
  originalValue: string;
  stability: string;
  versionText: string;
}): Constraint {
  const match = versionText.match(/^v?(?:(\d+(?:\.\d+){0,2})\.)?[xX*](?:\.[xX*])*$/i);
  if (operator !== "" || !match) {
    throw new Error(`malformed constraint: ${originalValue}`);
  }
  const prefix = match[1]?.split(".").map(Number) ?? [];
  return new Constraint({
    fn: (candidate) => prefix.every((segment, index) => candidate.segmentAt(index) === segment),
    operator: prefix.length === 0 ? "*" : operator,
    originalSegments: versionText.split(".").length,
    originalValue,
    stability,
    version: prefix.length === 0 ? null : parseVersion(prefix.join(".")),
  });
}

function prereleaseCheck(version: Version, check: Version): boolean {
  if (version.isPrerelease() && check.isPrerelease()) {
    return sameSegments(version.segments64(), check.segments64());
  }

  if (version.isPrerelease() && !check.isPrerelease()) {
    return true;
  }

  if (!version.isPrerelease() && check.isPrerelease()) {
    return false;
  }

  return true;
}

function constraintEqual(version: Version, check: Version | null): boolean {
  return !!check && version.equal(check);
}

function constraintNotEqual(version: Version, check: Version | null): boolean {
  return !!check && !version.equal(check);
}

function constraintGreaterThan(version: Version, check: Version | null): boolean {
  return !!check && canComparePrerelease(version, check) && version.compare(check) === 1;
}

function constraintLessThan(version: Version, check: Version | null): boolean {
  return !!check && canComparePrerelease(version, check) && version.compare(check) === -1;
}

function constraintGreaterThanEqual(version: Version, check: Version | null): boolean {
  if (!check) {
    return false;
  }

  if (version.isPrerelease() && !check.isPrerelease()) {
    return cloneForComparison(version).compare(cloneForComparison(check)) >= 0;
  }

  return canComparePrerelease(version, check) && version.compare(check) >= 0;
}

function constraintLessThanEqual(version: Version, check: Version | null): boolean {
  return !!check && canComparePrerelease(version, check) && version.compare(check) <= 0;
}

function constraintPessimistic(version: Version, check: Version | null): boolean {
  if (!check) {
    return false;
  }

  if (!prereleaseCheck(version, check) || (check.prerelease() && !version.prerelease())) {
    return false;
  }

  if (version.lessThan(check)) {
    return false;
  }

  for (let index = 0; index < check.specificity - 1; index += 1) {
    if (version.segmentAt(index) !== check.segmentAt(index)) {
      return false;
    }
  }

  const lastIndex = check.segmentCount() - 1;
  return (check.segmentAt(lastIndex) ?? 0) <= (version.segmentAt(lastIndex) ?? 0);
}

function constraintCaret(version: Version, check: Version | null): boolean {
  if (!check) {
    return false;
  }

  if (version.isPrerelease() && !check.isPrerelease()) {
    const bareVersion = cloneForComparison(version);
    const bareCheck = cloneForComparison(check);

    return !bareVersion.lessThan(bareCheck) && bareVersion.major() === bareCheck.major();
  }

  return !version.lessThan(check) && version.major() === check.major();
}

function constraintTilde(
  version: Version,
  check: Version | null,
  originalSegments: number,
): boolean {
  if (!check) {
    return false;
  }

  const bareVersion = cloneForComparison(version);
  const bareCheck = cloneForComparison(check);

  if (bareVersion.lessThan(bareCheck) || version.major() !== check.major()) {
    return false;
  }

  if (originalSegments >= 3 && version.minor() !== check.minor()) {
    return false;
  }

  if (version.isPrerelease() && !check.isPrerelease()) {
    return true;
  }

  if (
    check.specificity === version.segmentCount() &&
    sameSegments(version.segments64(), check.segments64())
  ) {
    return prereleaseCheck(version, check);
  }

  return true;
}

function canComparePrerelease(version: Version, check: Version): boolean {
  return !version.isPrerelease() || !check.isPrerelease() || prereleaseCheck(version, check);
}

function getVersionStability(version: Version): string {
  if (!version.isPrerelease()) {
    return "stable";
  }

  const pre = version.prerelease().toLowerCase();

  if (pre.startsWith("dev")) {
    return "dev";
  }

  if (pre.startsWith("alpha") || pre.startsWith("a")) {
    return "alpha";
  }

  if (pre.startsWith("beta") || pre.startsWith("b")) {
    return "beta";
  }

  if (pre.startsWith("rc")) {
    return "rc";
  }

  return "dev";
}

function sameSegments(left: number[], right: number[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
