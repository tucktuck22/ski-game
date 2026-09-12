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
 * SPRITE SHEETS ARE INLINED. They did not survive the packing until 2026-09-12
 * and nobody had noticed: this comment listed music and the draft, feature 004
 * then added sheets fetched the same way, and the artifact silently became a
 * playtest of the FALLBACK renderer. A play pass on the wrong skier is the exact
 * failure Principle VIII exists to prevent, so the sheets go in as data URIs -
 * they are about 1.4 KiB, which is nothing next to the bundle.
 *
 * The inlining is a HARNESS shim and never touches the game: `src/render/
 * sprites.ts` still builds every URL from `import.meta.env.BASE_URL`, and
 * FR-173's base-path defect stays exactly as catchable as it was. What the shim
 * does is redirect the resulting `img.src` to bytes that are already in the
 * page, because the artifact CSP will not let it fetch them.
 *
 * What still does NOT survive the packing, by design:
 *   - Music. It is fetched at runtime from public/audio (FR-146 keeps it out of
 *     the bundle), and the artifact CSP blocks that fetch. The player already
 *     treats a failed fetch as silence - tests/e2e-build/music-never-blocks -
 *     so the game plays, quietly. The two pieces are ~4 MB, which is ~5.3 MB of
 *     base64 against a 400 KiB bundle, and no play question this harness exists
 *     to answer is about sound.
 *   - A real draft. With no Supabase keys the app runs its clearly-labelled
 *     local session, which is what src/state/config.ts already does.
 * Both are why this is a playtest harness and not a way to ship the game.
 *
 * Usage: npm run build && node tools/build-artifact.mjs
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
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

/*
 * Every sprite sheet the build shipped, as data URIs keyed by file name.
 *
 * Read from dist/, so this packs whatever the build actually copied. A sheet
 * that is still a Git LFS pointer - 130-odd bytes of text where a PNG should be
 * - is REFUSED rather than inlined, because a broken sheet that silently
 * degrades to the fallback renderer is the thing this whole block exists to
 * stop happening twice.
 */
const spriteDir = resolve(root, 'dist/sprites');
const sheets = {};
if (existsSync(spriteDir)) {
  for (const file of readdirSync(spriteDir).filter((f) => f.endsWith('.png'))) {
    const bytes = readFileSync(resolve(spriteDir, file));
    const isPng = bytes.length > 8 && bytes.subarray(1, 4).toString('latin1') === 'PNG';
    if (!isPng) {
      throw new Error(
        `${file} is ${bytes.length} bytes and is not a PNG - almost certainly an ` +
          'unfetched Git LFS pointer. Run `git lfs pull` before building the artifact; ' +
          'packing it would produce a playtest of the fallback renderer.',
      );
    }
    sheets[file] = `data:image/png;base64,${bytes.toString('base64')}`;
  }
}
console.log(`  inlining ${Object.keys(sheets).length} sprite sheet(s)`);

/*
 * The shim. A plain script, so it runs before the deferred module below.
 *
 * It intercepts the `src` setter rather than patching any URL-building code,
 * which keeps the game's own base-path logic (FR-173) untouched and working: the
 * URL is still built exactly as it is in production, and only the final fetch is
 * answered from memory instead of from a server the artifact does not have.
 */
const shim = `<script>
(function () {
  var SHEETS = ${JSON.stringify(sheets)};
  var d = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  Object.defineProperty(HTMLImageElement.prototype, 'src', {
    configurable: true,
    get: function () { return d.get.call(this); },
    set: function (v) {
      var s = String(v);
      var hit = Object.keys(SHEETS).filter(function (f) {
        return s.indexOf('sprites/' + f) !== -1;
      })[0];
      d.set.call(this, hit ? SHEETS[hit] : v);
    },
  });
})();
</script>`;

/* The artifact host supplies <!doctype>, <html>, <head> and <body>, so this
   emits page CONTENT only. Title and style lead, as that head expects. */
const out = `<title>Shredpocalypse '86</title>
<style>
html, body { height: 100%; margin: 0; }
${css}
</style>
<div id="app"></div>
${shim}
<script type="module">
${js}
</script>
`;

const path = resolve(root, 'dist/artifact.html');
writeFileSync(path, out);
console.log(`${path}  ${(out.length / 1024).toFixed(0)} KiB`);
