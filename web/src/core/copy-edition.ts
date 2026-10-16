/** Version and Obi belong to the physical copy, not its MusicBrainz release. */
export function copyEditionLabel(pressing?: string, obi?: string): string {
  return [pressing?.trim(), obi?.trim()].filter(Boolean).join('·');
}
