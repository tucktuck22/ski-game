/**
 * Builds public/sprites/skier.png from the retained sources (FR-159, FR-160, FR-162).
 *
 * Run: npm run build:sprites
 *
 * A checked-in, re-runnable, deterministic tool rather than instructions in a
 * README, because Principle VII says anything a human is told to run is part of
 * the product and carries the same burden of proof as code.
 * `tests/unit/sprite-palette.test.ts` runs it and compares bytes, so a
 * hand-edited sheet or a source changed without a rebuild fails rather than
 * drifting.
 *
 * FRAMES ARE FOUND, NOT INDEXED BY GRID.
 *
 * The first version measured a pixel grid off one sheet and cut on those
 * constants. That worked for exactly one file and broke on the next, because
 * every generated sheet lays its cells out differently. This one instead finds
 * the character in each source by connected components over "saturated or
 * near-black" pixels: greys - the backing, the cell fill, the ground line, the
 * caption text - are neither, so they fall out for free, and a new source needs
 * no new constants. Snow spray and ski poles are joined to the body they belong
 * to by a small dilation before labelling.
 *
 * Frames come out in reading order, which is what SOURCES below indexes into.
 *
 * Colour is handled by MAJORITY VOTE over source pixels already quantised to the
 * palette, never by averaging them. Averaging is the obvious approach and it is
 * wrong for pixel art: this art is high contrast and outlined in near-black, so
 * the mean of an outline and the bright suit beside it is a mid purple. An
 * earlier build did exactly that and turned the magenta helmet purple.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));

const outFlag = process.argv.indexOf('--out');
const OUT =
  outFlag !== -1 && process.argv[outFlag + 1]
    ? process.argv[outFlag + 1]
    : here('../public/sprites/skier.png');

/** Output cell, and where the ski line sits in it. The anchor must be identical
 *  in every frame: it is the point that lands on the snow. */
const OUT_W = 32;
const OUT_H = 32;
const ANCHOR_X = 16;
const ANCHOR_Y = 26;

/**
 * Standing height in output pixels, including skis.
 *
 * data/tuning.json puts standHeight at 16 world units and the renderer this
 * replaces drew a 16px body over a 2px ski. Matching it keeps the character the
 * size the courses were built around; a bigger sprite would silently change how
 * much of the mountain a player can see past himself (FR-161).
 */
const STAND_H = 18;

/**
 * The sources, and which found frame supplies each pose.
 *
 * `refFrame`/`refHeight` set the scale for a source: the named frame is drawn at
 * that many output pixels tall and every other frame in the file is scaled to
 * match. Sources are generated at different zoom levels, so without this a
 * crouch cut from a three-cell image would tower over a carve cut from an
 * eight-cell one. `refHeight` is below STAND_H where the reference pose is
 * itself lower than standing - a crouch is not a stand.
 */
const SOURCES = [
  {
    file: '../assets/sprites/skier.source.png',
    minCore: 2500,
    refFrame: 0,
    refHeight: STAND_H,
    // The original sheet. Kept for CARVE ONLY: it is the one source whose carve
    // frames are drawn at genuinely different ski angles, which is what FR-183
    // needs and FR-185 forbids faking by rotation. Everything else now comes
    // from the cleaner sheets below.
    poses: { carveShallow: 0, carveMid: 11, carveSteep: 6 },
  },
  {
    file: '../assets/sprites/skier-poses.source.png',
    minCore: 1500,
    refFrame: 15,
    refHeight: STAND_H,
    poses: {
      launch: 0,
      air: 8,
      tuck: 10,
      spin: 11,
      absorbShallow: 1,
      absorbMid: 2,
      absorbSteep: 3,
    },
  },
  {
    file: '../assets/sprites/skier-crouch-leans.source.png',
    minCore: 1500,
    refFrame: 0,
    // A crouch is not a stand. tuning's crouchHeight is 9 against standHeight 16;
    // this is that ratio applied to STAND_H and then rounded up for the skis.
    refHeight: 13,
    poses: { crouchShallow: 0, crouchMid: 1, crouchSteep: 2 },
  },
  {
    file: '../assets/sprites/skier-wipeout.source.png',
    minCore: 1500,
    refFrame: 1,
    refHeight: 20,
    // The mid-tumble, deliberately, not the face-down final frame: the death
    // sequence spins and slides whatever is here, and a curled tumbling body
    // reads under rotation where a settled one would look wrong.
    poses: { wipeout: 1 },
  },
];

const PALETTE = [
  [0x0b, 0x06, 0x16], // ink
  [0x2b, 0x10, 0x55], // purple
  [0xff, 0x2d, 0x95], // magenta
  [0x22, 0xe8, 0xf5], // cyan
  [0x43, 0x61, 0xff], // blue
  [0xfc, 0x60, 0x08], // orange
  [0xff, 0xd2, 0x3f], // yellow
  [0xf2, 0xf0, 0xff], // snow
  [0xec, 0xb2, 0x91], // skin (ADR-0010)
];
const TRANSPARENT = PALETTE.length;

/**
 * `orange` is EXCLUDED from what a player sheet may quantise to, and that is a
 * rule rather than a preference: P-4 says hazards are orange and the player
 * never is. Excluding it makes FR-163 true by construction instead of by
 * review - an earlier build quantised the darker skin pixels to orange and put
 * a hazard colour on the player's face.
 */
const SHEET_COLOURS = PALETTE.map((_, i) => i).filter((i) => i !== 5);

/** Pose order in the output sheet. Cell index is the position in this list. */
const POSE_ORDER = [
  'carveShallow',
  'carveMid',
  'carveSteep',
  'crouchShallow',
  'crouchMid',
  'crouchSteep',
  'launch',
  'air',
  'tuck',
  'spin',
  'absorbShallow',
  'absorbMid',
  'absorbSteep',
  'wipeout',
];

const COLS = 8;

// ---------------------------------------------------------------- PNG codec

function decodePng(buf) {
  let o = 8;
  let ihdr = null;
  const idat = [];
  while (o + 8 <= buf.length) {
    const len = buf.readUInt32BE(o);
    const type = buf.slice(o + 4, o + 8).toString('ascii');
    const d = buf.slice(o + 8, o + 8 + len);
    if (type === 'IHDR')
      ihdr = { w: d.readUInt32BE(0), h: d.readUInt32BE(4), bd: d[8], ct: d[9], il: d[12] };
    else if (type === 'IDAT') idat.push(d);
    else if (type === 'IEND') break;
    o += 8 + len + 4;
  }
  if (ihdr.il !== 0) throw new Error('interlaced source not supported');
  if (ihdr.bd !== 8) throw new Error(`source bit depth ${ihdr.bd}, expected 8`);
  const chans = { 0: 1, 2: 3, 4: 2, 6: 4 }[ihdr.ct];
  if (!chans) throw new Error(`source colour type ${ihdr.ct} not supported`);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = ihdr.w * chans;
  const out = Buffer.alloc(ihdr.h * stride);
  let p = 0;
  for (let y = 0; y < ihdr.h; y++) {
    const filter = raw[p++];
    const line = raw.slice(p, p + stride);
    p += stride;
    const cur = out.slice(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.slice((y - 1) * stride, y * stride) : Buffer.alloc(stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= chans ? cur[i - chans] : 0;
      const b = prev[i];
      const c = i >= chans ? prev[i - chans] : 0;
      let v = line[i];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const pp = a + b - c;
        const pa = Math.abs(pp - a);
        const pb = Math.abs(pp - b);
        const pc = Math.abs(pp - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[i] = v & 255;
    }
  }
  return { ...ihdr, chans, data: out };
}

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

const crc32 = (b) => {
  let c = -1;
  for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 255] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function encodeIndexedPng(w, h, indices) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 3; // indexed. The structural guarantee behind FR-162.
  const raw = Buffer.alloc(h * (w + 1));
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) raw[y * (w + 1) + 1 + x] = indices[y * w + x];
  return Buffer.concat([
    Buffer.from('89504e470d0a1a0a', 'hex'),
    chunk('IHDR', ihdr),
    chunk('PLTE', Buffer.from([...PALETTE, [0, 0, 0]].flat())),
    // Fully opaque for every real colour, fully transparent for the last index.
    // Nothing partial: a half-alpha index would put a colour on screen that is
    // in the table but not the colour the table says.
    chunk('tRNS', Buffer.from([...PALETTE.map(() => 255), 0])),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------ frame finding

const isSaturated = (r, g, b) => Math.max(r, g, b) - Math.min(r, g, b) > 45;
const isOutline = (r, g, b) => Math.max(r, g, b) <= 70;
const isCharacter = (r, g, b) => isSaturated(r, g, b) || isOutline(r, g, b);

function findFrames(img, minCore, dilate = 3) {
  const { w, h, data, chans } = img;
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = data[i * chans];
    const g = data[i * chans + 1];
    const b = data[i * chans + 2];
    if (isCharacter(r, g, b)) mask[i] = 1;
  }
  const dil = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!mask[y * w + x]) continue;
      for (let dy = -dilate; dy <= dilate; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -dilate; dx <= dilate; dx++) {
          const xx = x + dx;
          if (xx >= 0 && xx < w) dil[yy * w + xx] = 1;
        }
      }
    }
  const seen = new Uint8Array(w * h);
  const found = [];
  for (let i = 0; i < w * h; i++) {
    if (!dil[i] || seen[i]) continue;
    const stack = [i];
    seen[i] = 1;
    let mnx = Infinity;
    let mny = Infinity;
    let mxx = -1;
    let mxy = -1;
    let core = 0;
    while (stack.length) {
      const p = stack.pop();
      const x = p % w;
      const y = (p - x) / w;
      if (mask[p]) core++;
      if (x < mnx) mnx = x;
      if (x > mxx) mxx = x;
      if (y < mny) mny = y;
      if (y > mxy) mxy = y;
      const push = (q) => {
        if (dil[q] && !seen[q]) {
          seen[q] = 1;
          stack.push(q);
        }
      };
      if (x > 0) push(p - 1);
      if (x < w - 1) push(p + 1);
      if (y > 0) push(p - w);
      if (y < h - 1) push(p + w);
    }
    if (core < minCore) continue;
    // Tighten back to the undilated mask so the box is the art, not the halo.
    let tx0 = Infinity;
    let ty0 = Infinity;
    let tx1 = -1;
    let ty1 = -1;
    for (let y = mny; y <= mxy; y++)
      for (let x = mnx; x <= mxx; x++) {
        if (!mask[y * w + x]) continue;
        if (x < tx0) tx0 = x;
        if (x > tx1) tx1 = x;
        if (y < ty0) ty0 = y;
        if (y > ty1) ty1 = y;
      }
    found.push({ x: tx0, y: ty0, w: tx1 - tx0 + 1, h: ty1 - ty0 + 1 });
  }
  // Reading order: rows by vertical overlap, then left to right within a row.
  found.sort((a, b) => a.y - b.y);
  const rows = [];
  for (const f of found) {
    const row = rows.find(
      (r) => Math.abs(r[0].y + r[0].h / 2 - (f.y + f.h / 2)) < Math.max(r[0].h, f.h) * 0.7,
    );
    if (row) row.push(f);
    else rows.push([f]);
  }
  for (const r of rows) r.sort((a, b) => a.x - b.x);
  return rows.flat();
}

// ------------------------------------------------------------------- build

const sheetW = OUT_W * COLS;
const sheetH = OUT_H * Math.ceil(POSE_ORDER.length / COLS);
const indices = new Uint8Array(sheetW * sheetH).fill(TRANSPARENT);
const placed = new Map();

for (const source of SOURCES) {
  const img = decodePng(fs.readFileSync(here(source.file)));
  const { w, h, data, chans } = img;
  const frames = findFrames(img, source.minCore);
  const ref = frames[source.refFrame];
  if (!ref) throw new Error(`${source.file}: reference frame ${source.refFrame} not found`);
  const scale = source.refHeight / ref.h;

  const nearest = (r, g, b) => {
    let best = SHEET_COLOURS[0];
    let bd = Infinity;
    for (const i of SHEET_COLOURS) {
      const d =
        (r - PALETTE[i][0]) ** 2 * 0.3 +
        (g - PALETTE[i][1]) ** 2 * 0.59 +
        (b - PALETTE[i][2]) ** 2 * 0.11;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return best;
  };

  for (const [pose, frameIndex] of Object.entries(source.poses)) {
    const box = frames[frameIndex];
    if (!box) throw new Error(`${source.file}: frame ${frameIndex} for "${pose}" not found`);
    const cell = POSE_ORDER.indexOf(pose);
    if (cell === -1) throw new Error(`"${pose}" is not in POSE_ORDER`);

    const dw = box.w * scale;
    const dh = box.h * scale;
    const cx = (cell % COLS) * OUT_W;
    const cy = Math.floor(cell / COLS) * OUT_H;
    const dx0 = ANCHOR_X - dw / 2;
    const dy0 = ANCHOR_Y - dh;

    for (let oy = 0; oy < OUT_H; oy++) {
      for (let ox = 0; ox < OUT_W; ox++) {
        const u0 = (ox - dx0) / dw;
        const u1 = (ox + 1 - dx0) / dw;
        const v0 = (oy - dy0) / dh;
        const v1 = (oy + 1 - dy0) / dh;
        if (u1 <= 0 || u0 >= 1 || v1 <= 0 || v0 >= 1) continue;
        const sx0 = Math.round(box.x + Math.max(0, u0) * box.w);
        const sx1 = Math.max(sx0 + 1, Math.round(box.x + Math.min(1, u1) * box.w));
        const sy0 = Math.round(box.y + Math.max(0, v0) * box.h);
        const sy1 = Math.max(sy0 + 1, Math.round(box.y + Math.min(1, v1) * box.h));

        const votes = new Map();
        let bg = 0;
        let n = 0;
        for (let y = sy0; y < sy1 && y < h; y++)
          for (let x = sx0; x < sx1 && x < w; x++) {
            const i = (y * w + x) * chans;
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            if (!isCharacter(r, g, b)) {
              bg++;
              continue;
            }
            const q = nearest(r, g, b);
            votes.set(q, (votes.get(q) || 0) + 1);
            n++;
          }
        let winner = TRANSPARENT;
        let bv = 0;
        for (const [q, c] of votes) {
          if (c > bv) {
            bv = c;
            winner = q;
          }
        }
        // The 1.2 bias keeps thin limbs and ski tips rather than eroding them,
        // without smearing a halo around the silhouette.
        if (n > 0 && bg <= n * 1.2) indices[(cy + oy) * sheetW + cx + ox] = winner;
      }
    }
    placed.set(pose, { cell, w: Math.round(dw), h: Math.round(dh) });
  }
}

/**
 * Drop isolated pixels.
 *
 * The sources carry small marks beside the character - ski pole tips, the
 * artist's direction arrows - which survive the downscale as single specks
 * floating in the cell. At 18px a stray pixel is a visible fleck of dirt rather
 * than detail, and style bible L-0 puts legibility above everything: a mark that
 * carries no information but draws the eye is a cost with no benefit.
 *
 * Only fully isolated pixels go. Anything with an orthogonal neighbour is part
 * of a shape and is kept, so thin limbs and ski tips survive.
 */
{
  const before = indices.slice();
  let removed = 0;
  for (let y = 0; y < sheetH; y++)
    for (let x = 0; x < sheetW; x++) {
      const i = y * sheetW + x;
      if (before[i] === TRANSPARENT) continue;
      // Neighbours are clamped to the CELL, not the sheet, so a sprite never
      // borrows support from the one beside it.
      const cellX = Math.floor(x / OUT_W) * OUT_W;
      const cellY = Math.floor(y / OUT_H) * OUT_H;
      const solid = (nx, ny) =>
        nx >= cellX &&
        nx < cellX + OUT_W &&
        ny >= cellY &&
        ny < cellY + OUT_H &&
        before[ny * sheetW + nx] !== TRANSPARENT;
      if (!solid(x - 1, y) && !solid(x + 1, y) && !solid(x, y - 1) && !solid(x, y + 1)) {
        indices[i] = TRANSPARENT;
        removed++;
      }
    }
  console.log(`  despeckled ${removed} isolated pixels`);
}

const missing = POSE_ORDER.filter((p) => !placed.has(p));
if (missing.length) throw new Error(`no source supplies: ${missing.join(', ')}`);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, encodeIndexedPng(sheetW, sheetH, indices));

const used = new Set(indices);
console.log(`wrote ${OUT}`);
console.log(`  ${sheetW}x${sheetH}, ${COLS} columns of ${OUT_W}x${OUT_H}`);
console.log(`  ${POSE_ORDER.length} poses from ${SOURCES.length} sources`);
console.log(`  ${used.size} of ${PALETTE.length + 1} palette slots used`);
console.log(`  ${fs.statSync(OUT).size} bytes`);
for (const pose of POSE_ORDER) {
  const p = placed.get(pose);
  console.log(`    ${String(p.cell).padStart(2)} ${pose.padEnd(14)} ${p.w}x${p.h}`);
}
