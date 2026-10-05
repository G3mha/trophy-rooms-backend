type PlatformWithReleases = {
  id: string;
  releases: Array<{ releaseDate: Date }>;
};

/**
 * Pick the platform that launched first, by each platform's earliest regional
 * release. Platforms with no release dates come last, and ties go to the
 * lowest id so the pick stays stable while release dates are missing.
 */
export function pickFirstReleasedPlatform<T extends PlatformWithReleases>(
  platforms: T[]
): T | undefined {
  return [...platforms].sort(compareByFirstRelease)[0];
}

function firstReleaseTime(platform: PlatformWithReleases): number {
  if (platform.releases.length === 0) return Number.POSITIVE_INFINITY;
  return Math.min(...platform.releases.map((release) => release.releaseDate.getTime()));
}

function compareByFirstRelease(a: PlatformWithReleases, b: PlatformWithReleases): number {
  const aRelease = firstReleaseTime(a);
  const bRelease = firstReleaseTime(b);
  if (aRelease !== bRelease) return aRelease < bRelease ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
