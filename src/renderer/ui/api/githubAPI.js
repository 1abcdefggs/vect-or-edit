export const CURRENT_APP_VERSION = '0.2.1';
export const GITHUB_REPO_URL = 'https://github.com/1abcdefggs/vect-or-edit';

/**
 * Checks if latest version has a Major or Minor update compared to current version.
 * Patch updates (e.g. 0.2.0 -> 0.2.1) return false.
 */
export function isMajorOrMinorUpdate(currentVer, latestVer) {
  if (!currentVer || !latestVer) return false;
  const parse = (v) => v.replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
  const [cMajor = 0, cMinor = 0] = parse(currentVer);
  const [lMajor = 0, lMinor = 0] = parse(latestVer);

  if (lMajor > cMajor) return true;
  if (lMajor === cMajor && lMinor > cMinor) return true;
  return false;
}

/**
 * Fetches the latest release from the GitHub API.
 */
export async function fetchLatestRelease() {
  const res = await fetch(`https://api.github.com/repos/1abcdefggs/vect-or-edit/releases/latest`, {
    headers: { 'Accept': 'application/vnd.github.v3+json' }
  });
  if (!res.ok) throw new Error('Failed to fetch release');
  const data = await res.json();

  return {
    latestTag: data.tag_name || data.name || '',
    releaseBody: data.body || 'New features, improvements and bug fixes.'
  };
}
