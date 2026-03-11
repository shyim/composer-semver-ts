import { Version } from "./version";

export function sortVersions(versions: Version[]): Version[] {
  return versions.sort((left, right) => left.compare(right));
}
