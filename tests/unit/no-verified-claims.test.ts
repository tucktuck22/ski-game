import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * FR-069 and SC-014.
 *
 * ADR-0004 accepts client-reported scores with no verification. The price of
 * that is honesty: the product must not claim standings are verified or
 * tamper-proof, anywhere. This test is the guard, because the tempting phrase
 * ("trusted", "verified") is exactly what a marketing-minded edit would add.
 */
const ROOT = new URL('../../', import.meta.url).pathname;

const SKIP = new Set([
  'node_modules',
  'dist',
  '.git',
  'coverage',
  'test-results',
  'playwright-report',
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|html|css|md|json)$/.test(name)) out.push(full);
  }
  return out;
}

/**
 * Phrases that would assert verification we do not perform.
 *
 * The negative lookbehinds matter. A first version of this guard flagged the
 * phrase "unverified scores" - which is the OPPOSITE of a claim, and appears in
 * the code precisely because we are being honest. A guard that fires on correct
 * text is a guard somebody eventually deletes.
 */
const FORBIDDEN = [
  /(?<!un)(?<!not )standings\s+(?:are|is)\s+verified/i,
  /(?<!un)verified\s+(?:standings|leaderboard|scores?)/i,
  /tamper[- ]proof/i,
  /cheat[- ]proof/i,
  /(?<!un)(?<!not )scores?\s+(?:are|is)\s+validated/i,
];

describe('the product never claims verification it does not perform (FR-069)', () => {
  const files = walk(ROOT).filter(
    // The spec, ADRs, plan and this test necessarily DISCUSS verification; they
    // are the record of deciding not to do it. What must not claim it is
    // anything a player or reader would take as a promise.
    (f) => !/specs\/|docs\/adr\/|no-verified-claims\.test\.ts$/.test(f),
  );

  it('scans a meaningful number of files', () => {
    expect(files.length).toBeGreaterThan(15);
  });

  for (const pattern of FORBIDDEN) {
    it(`no file asserts ${pattern.source}`, () => {
      const offenders = files.filter((f) => pattern.test(readFileSync(f, 'utf8')));
      expect(offenders.map((f) => f.replace(ROOT, ''))).toEqual([]);
    });
  }

  it('the README states plainly that v1 does not verify scores', () => {
    const readme = readFileSync(join(ROOT, 'README.md'), 'utf8');
    expect(readme).toMatch(/no replay verification|accepts scores as\s*\n?\s*reported/i);
  });
});
