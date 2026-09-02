/**
 * Link generation.
 *
 * FR-006: organizer actions live on a URL distinct from the player link. This
 * is secrecy, not authentication — anyone who obtains the organizer URL has
 * full organizer power, which the spec's Assumptions state plainly. It exists
 * to stop players stumbling into reset and removal controls, not to withstand
 * an attacker. Given ADR-0004 already accepts unverified scores, a stronger
 * claim here would be theatre.
 */

export interface DraftLinks {
  player: string;
  organizer: string;
}

/** 128 bits of URL-safe randomness. Enough that it will not be guessed. */
export function generateOrganizerSecret(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function buildLinks(origin: string, draftId: string, organizerSecret: string): DraftLinks {
  const base = origin.replace(/\/$/, '');
  return {
    player: `${base}/?draft=${encodeURIComponent(draftId)}`,
    organizer: `${base}/?draft=${encodeURIComponent(draftId)}&organizer=${encodeURIComponent(organizerSecret)}`,
  };
}

/** Reads the organizer secret from the current URL, if the holder has one. */
export function organizerSecretFromUrl(search: string): string | null {
  return new URLSearchParams(search).get('organizer');
}

/**
 * The player link must never carry the secret. Asserted rather than assumed,
 * because leaking it into a shared link is a single-character mistake that
 * would hand every player reset and removal powers.
 */
export function playerLinkIsClean(link: string, secret: string): boolean {
  return !link.includes(secret) && !link.includes('organizer=');
}
