import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  renderOrganizer,
  removalConfirmationText,
  RENAME_REFUSAL,
} from '../../src/ui/organizer.js';
import { buildLinks, playerLinkIsClean, organizerSecretFromUrl } from '../../src/state/links.js';
import type { EntryView } from '../../src/state/ordering.js';

const e = (o: Partial<EntryView> & { name: string; id: string }): EntryView => ({
  origin: 'organizer',
  claimed: false,
  practiceRunsUsed: 0,
  abandonedOfficialRuns: 0,
  removed: false,
  score: null,
  commitAt: null,
  outcome: null,
  ...o,
});

describe('organizer links (FR-006)', () => {
  const links = buildLinks('https://example.test/', 'draft-1', 'sekrit');

  it('keeps the secret out of the player link', () => {
    expect(playerLinkIsClean(links.player, 'sekrit')).toBe(true);
    expect(links.player).not.toContain('sekrit');
  });

  it('puts the secret only on the organizer link', () => {
    expect(links.organizer).toContain('organizer=sekrit');
    expect(organizerSecretFromUrl('?draft=d&organizer=sekrit')).toBe('sekrit');
    expect(organizerSecretFromUrl('?draft=d')).toBeNull();
  });

  it('detects a player link that leaked the secret', () => {
    expect(playerLinkIsClean('https://x/?draft=d&organizer=sekrit', 'sekrit')).toBe(false);
  });
});

describe('organizer removal (FR-074, FR-075)', () => {
  it('names the score being discarded rather than asking a generic are-you-sure', () => {
    const text = removalConfirmationText('Brother-in-law', 51234);
    expect(text).toContain('51,234');
    expect(text).toContain('cannot be undone');
    expect(text).toContain('not actually on the trip');
  });

  it('asks plainly for an uncommitted entry, with no alarming language', () => {
    expect(removalConfirmationText('Zach', null)).toBe('Remove Zach from the roster?');
  });

  it('refuses renaming a committed entry and explains why', () => {
    expect(RENAME_REFUSAL).toContain('remove the entry');
    expect(RENAME_REFUSAL).toContain('did not happen');
  });

  it('offers RELEASE only for a claimed but uncommitted entry', () => {
    const html = renderOrganizer(
      [
        e({ id: '1', name: 'Claimed', claimed: true }),
        e({
          id: '2',
          name: 'Committed',
          claimed: true,
          score: 500,
          commitAt: '2026-09-01T00:00:00Z',
        }),
        e({ id: '3', name: 'Unclaimed' }),
      ],
      '2026-09-10T23:00:00Z',
    );
    expect(html).toContain('data-release="1"');
    expect(html).not.toContain('data-release="2"');
    expect(html).not.toContain('data-release="3"');
  });

  it('shows who added each entry, so a stranger stands out (FR-073)', () => {
    const html = renderOrganizer(
      [e({ id: '1', name: 'Dave' }), e({ id: '2', name: 'Rando', origin: 'self_created' })],
      '2026-09-10T23:00:00Z',
    );
    expect(html).toContain('themselves');
    expect(html).toContain('>you<');
  });

  it('shows why an action did not happen, rather than failing silently', () => {
    const html = renderOrganizer([], '2026-09-10T23:00:00Z', 'The removal did not happen: denied');
    expect(html).toContain('id="organizer-error"');
    expect(html).toContain('The removal did not happen');
  });

  it('says nothing when there is nothing to say', () => {
    expect(renderOrganizer([], '2026-09-10T23:00:00Z')).not.toContain('organizer-error');
  });

  it('warns that reset has no undo', () => {
    const html = renderOrganizer([], '2026-09-10T23:00:00Z');
    expect(html).toContain('destroys every committed score');
    expect(html).toContain('no undo');
  });
});

/**
 * FR-006, and the defect that hid behind it.
 *
 * 0002_policies.sql denies every client role the writes these three actions
 * need, and the organizer holds the same anon key as every player - so for as
 * long as they were written as table writes they were simply denied, and the
 * throw took the whole page down with it. They go through the security-definer
 * functions in 0003_organizer.sql now, and must keep doing so: a well-meaning
 * "simplification" back to `.from(...).update(...)` would restore the bug
 * exactly, and every test in this file would still pass.
 *
 * supabase/tests/invariants.sql proves the database half against real Postgres.
 * This is the client half: that we still ask the right way.
 */
describe('organizer actions go through the secret-gated functions (FR-006)', () => {
  const client = readFileSync(new URL('../../src/state/supabase.ts', import.meta.url), 'utf8');
  const organizerSection = client.slice(client.indexOf('---- Organizer operations'));

  it('calls a function for each of the three the grants deny', () => {
    expect(organizerSection).toContain("rpc('organizer_set_deadline'");
    expect(organizerSection).toContain("rpc('organizer_remove_entry'");
    expect(organizerSection).toContain("rpc('organizer_reset_draft'");
  });

  it('passes the organizer secret with every one of them', () => {
    const calls = organizerSection.match(/rpc\('organizer_\w+',\s*\{[^}]*\}/g) ?? [];
    expect(calls).toHaveLength(3);
    for (const call of calls) expect(call).toContain('p_secret: this.organizerSecret');
  });

  it('does not write those tables directly, which the database refuses', () => {
    expect(organizerSection).not.toMatch(/from\('draft'\)\s*\.update/);
    expect(organizerSection).not.toMatch(/from\('committed_score'\)\s*\.delete/);
    expect(organizerSection).not.toMatch(/removed_at:/);
  });
});
