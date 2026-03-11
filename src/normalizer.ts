const STABILITY_PATTERN = "stable|beta|dev|alpha|RC";
const BRANCH_WILDCARD_VALUE = "9999999";

export function normalizeVersion(version: string): string {
  const trimmedVersion = version.trim();
  const originalVersion = trimmedVersion;
  let normalizedVersion = trimmedVersion;

  const aliasMatch = normalizedVersion.match(/^([^,\s]+)\s+as\s+([^,\s]+)$/);
  if (aliasMatch) {
    normalizedVersion = aliasMatch[1];
  }

  const stabilityRegexp = new RegExp(`@(?:${STABILITY_PATTERN})$`, "i");
  const stabilityMatch = normalizedVersion.match(stabilityRegexp);
  if (stabilityMatch) {
    normalizedVersion = normalizedVersion.slice(0, -stabilityMatch[0].length);
  }

  const lowerVersion = normalizedVersion.toLowerCase();
  if (lowerVersion === "master" || lowerVersion === "trunk" || lowerVersion === "default") {
    normalizedVersion = `dev-${normalizedVersion}`;
  }

  if (normalizedVersion.toLowerCase().startsWith("dev-")) {
    return `dev-${normalizedVersion.slice(4)}`;
  }

  const buildMatch = normalizedVersion.match(/^([^,\s+]+)\+[^\s]+$/);
  if (buildMatch) {
    normalizedVersion = buildMatch[1];
  }

  let matches: RegExpMatchArray | null = null;
  let modifierIndex = 0;

  const classicalRegexp = new RegExp(
    String.raw`^v?(\d{1,5})(\.\d+)?(\.\d+)?(\.\d+)?(?:-?(stable|beta|b|alpha|a|RC)(?:[.-]?(\d+))?(?:[.-]?(dev))?)?$`,
    "i",
  );
  matches = normalizedVersion.match(classicalRegexp);
  if (matches) {
    const major = matches[1];
    const minor = matches[2] ?? ".0";
    const patch = matches[3] ?? ".0";
    const build = matches[4] ?? ".0";
    normalizedVersion = `${major}${minor}${patch}${build}`;
    modifierIndex = 5;
  } else {
    const dateRegexp = new RegExp(
      String.raw`^v?(\d{4}(?:[.:-]?\d{2}){1,6}(?:[.:-]?\d{1,3}){0,2})(?:-(stable|beta|b|alpha|a|RC)(?:[.-]?(\d+))?(?:[.-]?(dev))?)?$`,
      "i",
    );
    matches = normalizedVersion.match(dateRegexp);
    if (matches) {
      normalizedVersion = matches[1].replace(/\D/g, ".");
      modifierIndex = 2;
    }
  }

  if (matches && modifierIndex < matches.length) {
    if (matches[modifierIndex]) {
      if (matches[modifierIndex].toLowerCase() === "stable") {
        return normalizedVersion;
      }

      normalizedVersion += `-${expandStability(matches[modifierIndex])}`;
      let extra = "";
      if (matches[modifierIndex + 1]) {
        extra = matches[modifierIndex + 1].replace(/^[.-]+/, "");
      }
      normalizedVersion += extra;
    }

    if (matches[modifierIndex + 2]) {
      normalizedVersion += "-dev";
    }

    return normalizedVersion;
  }

  const devBranchMatch = normalizedVersion.match(/(.*?)[.-]?dev$/i);
  if (devBranchMatch) {
    const branch = normalizeBranch(devBranchMatch[1]);
    if (!branch.includes("dev-")) {
      return branch;
    }
  }

  let extraMessage = "";
  const aliasExactRegexp = new RegExp(
    ` +as +${escapeRegExp(normalizedVersion)}(?:@(?:stable|beta|alpha|RC))?$`,
  );
  if (aliasExactRegexp.test(originalVersion)) {
    extraMessage = ` in "${originalVersion}", the alias must be an exact version`;
  } else {
    const aliasSourceRegexp = new RegExp(
      `^${escapeRegExp(normalizedVersion)}(?:@(?:stable|beta|alpha|RC))? +as +`,
    );
    if (aliasSourceRegexp.test(originalVersion)) {
      extraMessage =
        ` in "${originalVersion}", the alias source must be an exact version, ` +
        "if it is a branch name you should prefix it with dev-";
    }
  }

  throw new Error(`invalid version string "${originalVersion}"${extraMessage}`);
}

export function normalizeBranch(name: string): string {
  const trimmedName = name.trim();
  const branchRegexp = /^v?(\d+)(\.(\d+|[xX*]))?(\.(\d+|[xX*]))?(\.(\d+|[xX*]))?$/i;
  const match = trimmedName.match(branchRegexp);
  if (match) {
    const segments = [match[1], match[3] ?? "x", match[5] ?? "x", match[7] ?? "x"]
      .map((segment) => segment.replaceAll("*", "x").replaceAll("X", "x"))
      .map((segment) => (segment === "x" ? BRANCH_WILDCARD_VALUE : segment));

    return `${segments.join(".")}-dev`;
  }

  return `dev-${trimmedName}`;
}

export function expandStability(stability: string): string {
  switch (stability.toLowerCase()) {
    case "a":
      return "alpha";
    case "b":
      return "beta";
    case "p":
    case "pl":
      return "patch";
    case "rc":
      return "rc";
    default:
      return stability.toLowerCase();
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}
