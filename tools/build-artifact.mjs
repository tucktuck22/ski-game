/**
 * Packs the production build into ONE self-contained HTML file, for publishing
 * as a Claude artifact so the real game can be played from a remote session.
 *
 * Why this exists: a remote container has no browser you can reach, so there is
 * no play loop for track work. Publishing the REAL build - the real simulation,
 * the real course data, the real renderer - avoids the alternative, which is a
 * second copy of the physics living inside a hand-written page. A second copy
 * would drift from src/sim, and Principle II makes determinism load-bearing for
 * the leaderboard. There is exactly one simulation, and this ships it.
 *
 * What does NOT survive the packing, by design:
 *   - Music. It is fetched at runtime from public/audio (FR-146 keeps it out of
 *     the bundle), and the artifact CSP blocks that fetch. The player already
 *     treats a failed fetch as silence - tests/e2e-build/music-never-blocks -
 *     so the game plays, quietly.
 *   - A real draft. With no Supabase keys the app runs its clearly-labelled
 *     local session, which is what src/state/config.ts already does.
 * Neither matters for reading a track. Both are why this is a playtest harness
 * and not a way to ship the game.
 *
 * Usage: npm run build && node tools/build-artifact.mjs
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist/assets');

const pick = (ext) => {
  const hit = readdirSync(dist).find((f) => f.endsWith(ext));
  if (!hit) throw new Error(`no ${ext} in dist/assets - run npm run build first`);
  return readFileSync(resolve(dist, hit), 'utf8');
};

const css = pick('.css');
// A sourcemap comment would point at a file the artifact does not serve, and
// `</script` inside a string literal would close the tag we are about to open.
const js = pick('.js')
  .replace(/\/\/# sourceMappingURL=.*$/m, '')
  .replace(/<\/script/gi, '<\\/script');

/* The artifact host supplies <!doctype>, <html>, <head> and <body>, so this
   emits page CONTENT only. Title and style lead, as that head expects. */
const out = `<title>Shredpocalypse '86</title>
<style>
html, body { height: 100%; margin: 0; }
${css}
</style>
<div id="app"></div>
<script type="module">
${js}
</script>
`;

const path = resolve(root, 'dist/artifact.html');
writeFileSync(path, out);
console.log(`${path}  ${(out.length / 1024).toFixed(0)} KiB`);
