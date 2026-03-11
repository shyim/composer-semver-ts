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
  ["*", constraintWildcard],
]);

const simpleOperators = [">", "<", ">=", "<=", "!=", "==", "~>", "~"];
const constraintRegexp = new RegExp(
  String.raw`^\s*(=|==|!=|<>|>|<|>=|<=|~>|\^|~|)\s*v?([0-9*]+(?:\.[0-9*]+)*(?:-[0-9A-Za-z-.]+)?(?:\+[0-9A-Za-z-.]+)?)(?:@([A-Za-z]+))?\s*$`,
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
  const groups = input.replaceAll("||", "|").split("|").map(parseConstraintGroup);
  return new Constraints(groups);
}

export function parseSingle(input: string): Constraint {
  if (input.trim() === "*") {
    return new Constraint({
      fn: constraintWildcard,
      operator: "*",
      originalSegments: 1,
      originalValue: input,
      stability: "",
      version: null,
    });
  }

  const match = input.match(constraintRegexp);
  if (!match) {
    throw new Error(`malformed constraint: ${input}`);
  }

  const [, operator, versionText, stabilityText = ""] = match;
  const stability = stabilityText.toLowerCase();

  if (stability && !stabilityLevels.has(stability)) {
    throw new Error(`unknown stability: ${stability}`);
  }

  if (versionText.includes("*")) {
    return parseWildcardConstraint({ operator, originalValue: input, stability, versionText });
  }

  const fn = operatorHandlers.get(operator);
  if (!fn) {
    throw new Error(`malformed constraint: ${input}`);
  }

  return new Constraint({
    fn,
    operator,
    originalSegments: versionText.split(".").length,
    originalValue: input,
    stability,
    version: parseVersion(versionText),
  });
}

function parseConstraintGroup(input: string): Constraint[] {
  if (input.includes(" - ")) {
    const parts = input.split(" - ");
    if (parts.length !== 2) {
      throw new Error(`malformed constraint: ${input}`);
    }

    return [parseSingle(`>=${parts[0].trim()}`), parseSingle(`<=${parts[1].trim()}`)];
  }

  return normalizeConstraintTokens(input).split(",").filter(Boolean).map(parseSingle);
}

function normalizeConstraintTokens(input: string): string {
  const tokens = input.trim().split(/\s+/).filter(Boolean);
  const normalized: string[] = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const next = tokens[index + 1];

    if (isOperator(token) && next) {
      normalized.push(`${token}${next}`);
      index += 1;
      continue;
    }

    normalized.push(token);
  }

  return normalized.join(",");
}

function isOperator(value: string): boolean {
  return operatorHandlers.has(value) || simpleOperators.includes(value);
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
  const parts = versionText.split(".");
  const starIndex = parts.indexOf("*");

  if (starIndex === -1 || starIndex !== parts.length - 1 || parts.lastIndexOf("*") !== starIndex) {
    throw new Error(`malformed constraint: ${originalValue}`);
  }

  if (starIndex === 1) {
    const version = parseVersion(`${parts[0]}.0.0`);
    return wildcardConstraint({
      originalSegments: 2,
      originalValue,
      operator,
      stability,
      version,
      test: (candidate, check) =>
        compareWildcardSegment(operator, candidate.major(), check.major()),
    });
  }

  if (starIndex === 2) {
    const version = parseVersion(`${parts[0]}.${parts[1]}.0`);
    return wildcardConstraint({
      originalSegments: 3,
      originalValue,
      operator,
      stability,
      version,
      test: (candidate, check) => {
        if (candidate.major() !== check.major()) {
          return compareWildcardSegment(operator, candidate.major(), check.major(), true);
        }

        return compareWildcardSegment(operator, candidate.minor(), check.minor());
      },
    });
  }

  throw new Error(`malformed constraint: ${originalValue}`);
}

function wildcardConstraint({
  originalSegments,
  originalValue,
  operator,
  stability,
  test,
  version,
}: {
  originalSegments: number;
  originalValue: string;
  operator: string;
  stability: string;
  test: (candidate: Version, check: Version) => boolean;
  version: Version;
}): Constraint {
  return new Constraint({
    fn: (candidate, check) => Boolean(check && test(candidate, check)),
    operator,
    originalSegments,
    originalValue,
    stability,
    version,
  });
}

function compareWildcardSegment(
  operator: string,
  candidate: number,
  check: number,
  majorMismatch = false,
): boolean {
  switch (operator) {
    case ">=":
      return candidate >= check;
    case ">":
      return candidate > check;
    case "<=":
      return candidate <= check;
    case "<":
      return candidate < check;
    case "!=":
    case "<>":
      return majorMismatch ? true : candidate !== check;
    case "":
    case "=":
    case "==":
      return majorMismatch ? false : candidate === check;
    default:
      return majorMismatch ? false : candidate === check;
  }
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

function constraintWildcard(): boolean {
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
