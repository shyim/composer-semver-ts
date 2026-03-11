import { normalizeVersion } from "./normalizer";

export const VERSION_REGEXP_RAW = String.raw`[\^~v]?([0-9]+(\.[0-9]+)*?)(-([0-9]+[0-9A-Za-z\-~]*(\.[0-9A-Za-z\-~]+)*)|([-@]?([A-Za-z\-~]+[0-9A-Za-z\-~]*(\.[0-9A-Za-z\-~]+)*)))?(\+([0-9A-Za-z\-~]+(\.[0-9A-Za-z\-~]+)*))?`;

const versionRegexp = new RegExp(`^${VERSION_REGEXP_RAW}$`);

export class Version {
  #metadata: string;
  #original: string;
  #pre: string;
  #segments: number[];

  specificity: number;

  constructor(
    metadata: string,
    pre: string,
    segments: number[],
    specificity: number,
    original: string,
  ) {
    this.#metadata = metadata;
    this.#pre = pre;
    this.#segments = segments;
    this.specificity = specificity;
    this.#original = original;
  }

  compare(other: Version): number {
    if (this.normalizedString() === other.normalizedString()) {
      return 0;
    }

    if (sameSegments(this.#segments, other.#segments)) {
      return compareReleaseLabels(this.#pre, other.#pre);
    }

    return compareSegments(this.#segments, other.#segments);
  }

  equal(other: Version): boolean {
    return this.compare(other) === 0;
  }

  greaterThan(other: Version): boolean {
    return this.compare(other) > 0;
  }

  greaterThanOrEqual(other: Version): boolean {
    return this.compare(other) >= 0;
  }

  lessThan(other: Version): boolean {
    return this.compare(other) < 0;
  }

  lessThanOrEqual(other: Version): boolean {
    return this.compare(other) <= 0;
  }

  metadata(): string {
    return this.#metadata;
  }

  prerelease(): string {
    return this.#pre;
  }

  isPrerelease(): boolean {
    return this.#pre !== "";
  }

  segments(): number[] {
    return [...this.#segments];
  }

  segments64(): number[] {
    return [...this.#segments];
  }

  major(): number {
    return this.#segments[0];
  }

  minor(): number {
    return this.#segments[1];
  }

  patch(): number {
    return this.#segments[2];
  }

  segmentAt(index: number): number | undefined {
    return this.#segments[index];
  }

  segmentCount(): number {
    return this.#segments.length;
  }

  increaseMajor(): void {
    this.#segments[0] += 1;
    this.#segments[1] = 0;
    this.#segments[2] = 0;
    this.#segments[3] = 0;
  }

  increaseMinor(): void {
    this.#segments[1] += 1;
    this.#segments[2] = 0;
    this.#segments[3] = 0;
  }

  increasePatch(): void {
    this.#segments[2] += 1;
    this.#segments[3] = 0;
  }

  toString(): string {
    return this.#original;
  }

  normalizedString(): string {
    const suffix = this.#pre ? `-${this.#pre}` : "";
    const metadata = this.#metadata ? `+${this.#metadata}` : "";
    return `${this.#segments.join(".")}${suffix}${metadata}`;
  }

  original(): string {
    return this.#original;
  }
}

export function parseVersion(input: string): Version {
  const normalized = normalizeVersion(input);
  const match = normalized.match(versionRegexp);

  if (!match) {
    throw new Error(`malformed version: ${input}`);
  }

  const segments = match[1].split(".").map((value) => Number.parseInt(value, 10));
  if (segments.some(Number.isNaN)) {
    throw new Error(`error parsing version: ${input}`);
  }

  const specificity = segments.length;
  while (segments.length < 3) {
    segments.push(0);
  }

  return new Version(match[10] ?? "", match[7] || match[4] || "", segments, specificity, input);
}

export function cloneForComparison(version: Version): Version {
  return new Version("", "", version.segments64(), version.specificity, version.original());
}

function compareSegments(left: number[], right: number[]): number {
  const maxLength = Math.max(left.length, right.length);

  for (let index = 0; index < maxLength; index += 1) {
    const leftValue = left[index];
    const rightValue = right[index];

    if (leftValue === undefined) {
      return hasNonZero(right.slice(index)) ? -1 : 0;
    }

    if (rightValue === undefined) {
      return hasNonZero(left.slice(index)) ? 1 : 0;
    }

    if (leftValue !== rightValue) {
      return leftValue < rightValue ? -1 : 1;
    }
  }

  return 0;
}

function compareReleaseLabels(left: string, right: string): number {
  if (left === right) {
    return 0;
  }

  if (!left) {
    return 1;
  }

  if (!right) {
    return -1;
  }

  const leftParts = left.split(".");
  const rightParts = right.split(".");
  const maxLength = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < maxLength; index += 1) {
    const result = compareReleasePart(leftParts[index] ?? "", rightParts[index] ?? "");
    if (result !== 0) {
      return result;
    }
  }

  return 0;
}

function compareReleasePart(left: string, right: string): number {
  if (left === right) {
    return 0;
  }

  const leftIsNumber = /^\d+$/.test(left);
  const rightIsNumber = /^\d+$/.test(right);

  if (!left) {
    return rightIsNumber ? -1 : 1;
  }

  if (!right) {
    return leftIsNumber ? 1 : -1;
  }

  if (leftIsNumber !== rightIsNumber) {
    return leftIsNumber ? -1 : 1;
  }

  if (leftIsNumber && rightIsNumber) {
    return Number(left) < Number(right) ? -1 : 1;
  }

  return left < right ? -1 : 1;
}

function sameSegments(left: number[], right: number[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function hasNonZero(values: number[]): boolean {
  return values.some((value) => value !== 0);
}
