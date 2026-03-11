# composer-semver

Composer-style semantic version parsing and constraint matching for JavaScript.

This package is a TypeScript/JavaScript port of Composer-like version handling with support for:

- version normalization
- prerelease comparison
- exact, range, tilde (`~`), caret (`^`), and wildcard constraints
- branch-style versions like `6.5.x-dev`

## Install

```bash
npm install composer-semver
```

```bash
pnpm add composer-semver
```

```bash
yarn add composer-semver
```

```bash
bun add composer-semver
```

## Usage

```ts
import { parseConstraint, parseVersion } from "composer-semver";

const version = parseVersion("1.2.3-beta1");
const constraint = parseConstraint("^1.2");

console.log(version.normalizedString());
// 1.2.3.0-beta1

console.log(constraint.check(version));
// true
```

## Parse Versions

```ts
import { parseVersion } from "composer-semver";

const version = parseVersion("v1.2.3+build.5");

console.log(version.normalizedString());
// 1.2.3.0

console.log(version.major(), version.minor(), version.patch());
// 1 2 3

console.log(version.prerelease());
// ""
```

## Compare Versions

```ts
import { parseVersion } from "composer-semver";

const stable = parseVersion("1.2.3");
const rc = parseVersion("1.2.3-rc1");

console.log(stable.greaterThan(rc));
// true

console.log(rc.lessThan(stable));
// true

console.log(parseVersion("1.2.3-alpha1").compare(parseVersion("1.2.3-alpha2")));
// -1
```

## Check Constraints

```ts
import { parseConstraint, parseVersion } from "composer-semver";

const constraint = parseConstraint(">=1.0 <2.0");

console.log(constraint.check(parseVersion("1.5.0")));
// true

console.log(constraint.check(parseVersion("2.0.0")));
// false
```

### Tilde and Caret

```ts
import { parseConstraint, parseVersion } from "composer-semver";

console.log(parseConstraint("~6.6").check(parseVersion("6.7.0")));
// true

console.log(parseConstraint("~6.6.0").check(parseVersion("6.7.0")));
// false

console.log(parseConstraint("^1.0.0").check(parseVersion("1.9.9")));
// true

console.log(parseConstraint("^1.0.0").check(parseVersion("2.0.0")));
// false
```

### Wildcards

```ts
import { parseConstraint, parseVersion } from "composer-semver";

console.log(parseConstraint("2.*").check(parseVersion("2.5.0")));
// true

console.log(parseConstraint("2.0.*").check(parseVersion("2.1.0")));
// false
```

### OR Constraints

```ts
import { parseConstraint, parseVersion } from "composer-semver";

const constraint = parseConstraint("~1.2.3 || ^2.0.0");

console.log(constraint.check(parseVersion("1.2.4")));
// true

console.log(constraint.check(parseVersion("2.1.0")));
// true
```

## Sort Versions

```ts
import { parseVersion, sortVersions } from "composer-semver";

const versions = [
  parseVersion("6.5.0.0-rc2"),
  parseVersion("6.3.1.0"),
  parseVersion("6.5.0.0-rc1"),
  parseVersion("6.5.0.0"),
];

sortVersions(versions);

console.log(versions.map((version) => version.normalizedString()));
// ["6.3.1.0", "6.5.0.0-rc1", "6.5.0.0-rc2", "6.5.0.0"]
```

## Normalize Versions and Branches

```ts
import { normalizeBranch, normalizeVersion } from "composer-semver";

console.log(normalizeVersion("1.0.0RC1"));
// 1.0.0.0-rc1

console.log(normalizeVersion("master"));
// dev-master

console.log(normalizeBranch("v1.x"));
// 1.9999999.9999999.9999999-dev
```

## API

### Exports

- `parseVersion(input)`
- `parseConstraint(input)`
- `parseSingle(input)`
- `sortVersions(versions)`
- `normalizeVersion(input)`
- `normalizeBranch(input)`
- `expandStability(input)`
- `VERSION_REGEXP_RAW`
- `Version`
- `Constraint`
- `Constraints`

### `Version`

- `compare(other)`
- `equal(other)`
- `greaterThan(other)`
- `greaterThanOrEqual(other)`
- `lessThan(other)`
- `lessThanOrEqual(other)`
- `normalizedString()`
- `original()`
- `metadata()`
- `prerelease()`
- `isPrerelease()`
- `segments()`
- `segments64()`
- `major()`
- `minor()`
- `patch()`
- `increaseMajor()`
- `increaseMinor()`
- `increasePatch()`

### `Constraints`

- `check(version)`
- `toString()`

## Development

```bash
bun install
bun test
bun run build
```

The package is built with `tsdown`.
