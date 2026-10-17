/** MusicBrainz sometimes brackets an editorially supplied release title. */
export function displayReleaseTitle(raw: string): string {
  const title = raw.trim();
  return /^\[[^\[\]]+\]$/.test(title) ? title.slice(1, -1).trim() : title;
}

/** JP/non-JP is the existing copy classification; retain the real country code in storage. */
export function releaseRegion(country?: string, oldPressing?: string): string {
  const code = (country || '').trim().toUpperCase();
  if (code) return code === 'JP' ? '日版' : '外版';
  return oldPressing === '日版' || oldPressing === '外版' ? oldPressing : '';
}

/** Display art may be from a digital album but it must be a true title and
 * artist match. Never silently replace it with a fuzzy or CAA group result. */
export function exactDigitalCover<T extends {exact: boolean; provider?: string}>(choices: T[]): T | undefined {
  return choices.find(choice => choice.exact && choice.provider === 'iTunes');
}
