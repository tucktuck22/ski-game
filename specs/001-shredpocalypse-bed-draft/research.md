# Phase 0 Research: Shredpocalypse '86

**Date**: 2026-09-01 | **Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

Supersedes the draft written before the 2026-09-01 clarification session. That
draft assumed an unspecified camera and had nothing on physics tuning or course
data. Its storage, determinism, and offline conclusions survive; its rendering
section is rewritten and three sections are new.

---

## R1. Target platform, reference hardware, and performance budgets

**Resolves**: `TODO(TARGET_PLATFORM_BASELINE)` in the constitution.

### Decision

Target the **evergreen mobile web**: Chromium, Firefox, and Safari on iOS 16+ and
Android 10+, and the same engines on desktop. No install, no app store, no native
build.

**Reference hardware** is a 2022-era mid-range phone — Pixel 6a / Galaxy A54 /
iPhone SE 3rd gen class. CI approximates it with headless Chromium under **4× CPU
throttling**, plus Fast 3G emulation for load measurements.

| Budget | Value | Source |
|---|---|---|
| Simulation step | ≤ 2.0 ms per 60 Hz tick at 4× throttle | FR-025 |
| Frame time | ≤ 16.7 ms p95; ≥ 50 fps sustained through a run | SC-009 |
| Input to visible response | ≤ 2 simulation frames (33.4 ms) | FR-031 |
| Initial payload | ≤ 2 MB gzipped, all assets | SC-001 |
| Time to interactive | ≤ 5 s on Fast 3G, cold cache | SC-001 |
| Peak JS heap | ≤ 150 MB | Principle II |

### Rationale

The product is a link in a group chat. An install, an account, or a 20 MB download
loses players before the first run, and SC-001 allows 60 seconds from tap to
practice. The reference device follows from who actually plays: most of an
eight-person ski trip opens this on a phone on lodge wifi. Budgeting against
desktop would invert SC-006's parity requirement.

CPU throttling is a proxy, not a measurement. It catches regressions and
order-of-magnitude mistakes; it does not replace the human playtest that Definition
of Done item 6 requires on real hardware.

### Alternatives considered

- **Unity WebGL** — rejected. 10–20 MB builds and slow mobile Safari startup break
  the payload and interactivity budgets before any game code exists.
- **Godot 4 web export** — rejected. Smaller, still multi-megabyte WASM, with known
  mobile-Safari audio and threading friction.
- **Native iOS/Android** — rejected. App stores are fatal to "tap the link," and
  double the platform surface for eight players.

---

## R2. Determinism: keeping the simulation bit-identical

**Satisfies**: constitution Technical Standards ("floating-point behavior MUST be
specified and pinned, or fixed-point arithmetic used"), FR-026.

### Decision

**IEEE-754 float64 restricted to the exactly-specified operations** — `+`, `-`,
`*`, `/` — with everything else banned in simulation code.

ECMAScript mandates IEEE-754 doubles, and those four operators are correctly
rounded, so they give identical results on every engine and CPU. The
non-determinism people associate with floating point in JS comes from `Math.sin`,
`Math.cos`, `Math.pow`, `Math.exp`, `Math.atan2` and friends, which are explicitly
implementation-approximated and **do** differ across V8, SpiderMonkey, and
JavaScriptCore.

Enforcement is three-layered, because a rule nobody *can* break beats a rule
everybody *remembers*:

1. **Lint** — `no-restricted-properties` bans `Math.*`, `Date.*`, and
   `performance.*` inside `src/sim/**`. Rotation trigonometry comes from a
   generated lookup table checked in as data. Square roots are avoided by
   comparing squared magnitudes; where unavoidable, a deterministic integer Newton
   iteration is used instead of `Math.sqrt`.
2. **Golden-run test** — a recorded seed plus input trace must reproduce an exact
   score and an exact end-state hash, asserted on Chromium, Firefox, **and** WebKit
   through Playwright. Three engines agreeing is the proof; the argument above is
   only the reason to expect it.
3. **Structural** — the simulation is a pure `step(state, input) → state` in
   `src/sim/`, importing nothing from rendering, audio, storage, or the DOM.

### Rationale

Fixed point was the obvious candidate and is worse here. Q16.16 multiplication
needs a 64-bit intermediate, which JavaScript lacks — `int32 × int32` overflows the
2^53 exact-integer range of a double, so every multiply becomes a `BigInt` (too slow
for the 2 ms budget) or a hand-split high/low routine that is its own bug farm.
Once the lint rule and the three-engine golden test exist, fixed point buys no
additional safety for considerably more friction in the code that most needs to
stay readable — which, after the clarifications, is a real physics model rather
than a toy.

**Residual risk, stated plainly**: `Math.sqrt` is correctly rounded on every
mainstream engine, but ECMAScript's guarantee for it is weaker than for the four
arithmetic operators. That is why it is banned outright rather than discouraged.

### Alternatives considered

- **Q16.16 fixed point** — rejected above.
- **`Math.fround` normalisation** — rejected. Narrowing to float32 costs precision
  without removing the transcendental problem, which is the actual divergence source.
- **Float64 without enforcement** — rejected. Works until someone writes `Math.sin`
  in a physics tweak at 1 a.m., then silently produces different scores per browser.

---

## R3. Physics model: crisp, momentum-based, and reproducible

**Resolves**: FR-077 through FR-084, FR-087, FR-088.

### Decision

A **semi-implicit (symplectic) Euler integrator on a fixed 60 Hz timestep**, over a
small state: position, velocity, angular orientation, angular velocity, crouch
charge, and ground-contact flag. Terrain is a piecewise-linear height profile;
ground contact resolves against the local slope segment's angle.

The control model collapses to one charge-and-release verb:

| Player action | Simulation effect |
|---|---|
| Hold crouch, grounded | Accelerate above base speed toward a tuck maximum; reduce collision profile |
| Release crouch, grounded, overhead clear | Launch impulse composed with current velocity — faster tuck throws a longer jump |
| Release crouch, grounded, low obstacle overhead | Launch into the obstacle; wipeout (FR-088) |
| Rotate, airborne | Angular velocity toward a tuning-capped rate; accumulates trick rotation |
| Land | Compare orientation against slope angle; within tolerance is clean, outside is a wipeout |
| Attack | Destroy a destructible barrier within reach; cooldown from tuning data |

### Rationale

Semi-implicit Euler is the standard choice for platformers: it is one line more
than explicit Euler, conserves energy far better under gravity, and — decisively
here — uses only `+`, `-`, `*` on state, so it stays inside R2's allowed operations.
RK4 would be more accurate, costs four evaluations per tick against a 2 ms budget,
and buys accuracy this game does not need.

A piecewise-linear height profile rather than curves keeps contact resolution to a
segment lookup and a dot product. It also makes FR-089's safe-release-window rule
statically checkable, which SC-016 requires: with linear segments and axis-aligned
obstacle boxes, "is there a clear stretch of length L after this obstacle at
reachable height" is a scan over the course data, not a simulation.

Fixed timestep is not optional. It is required by the constitution's Technical
Standards, by FR-025, and by FR-026 — and it is what makes SC-006 achievable, since
a 120 Hz desktop and a 60 Hz phone advance the simulation identically and differ
only in how often they interpolate for display.

### Alternatives considered

- **A physics library (Matter.js, Planck.js)** — rejected. Both are float-based
  general solvers with iteration counts and broadphase ordering that are not built
  for bit-determinism, and both are heavier than the entire simulation this game
  needs. A skier on a height profile is not a rigid-body problem.
- **Explicit Euler** — rejected. Gains energy under gravity, which shows up as a
  skier who accelerates on flats; the fix is one term away in semi-implicit.
- **Curved (spline) terrain** — rejected. Prettier contact, but turns FR-089's
  clearance check into root-finding and the collision test into an iterative solve.

---

## R4. Course data: one format, two courses, statically verifiable

**Resolves**: FR-036, FR-067, FR-068, FR-089, SC-016.

### Decision

Both the warm-up and official courses are declared in a single versioned data
format: a terrain profile as an ordered list of height points, plus obstacle,
barrier, and pickup placements. See
[contracts/course-data.md](contracts/course-data.md) for the schema.

A **course validator** runs in CI over both courses and fails the build on any of:
a low obstacle without a following safe release window of the minimum length
(FR-089), a destructible barrier whose bypass is not slower or lower-scoring than
breaking through (FR-081), a section unreachable at base speed, or a terrain
profile with a discontinuity the contact solver cannot resolve.

### Rationale

FR-089 is the requirement most likely to be broken by accident. A single low beam
placed just before a long tunnel makes the course unfinishable for exactly the
players FR-035 protects, and it would not be obvious by eye — it would surface as
one friend saying the game is impossible. SC-016 asks for automated verification
precisely because human review misses this, and making the check possible is why
R3 chose linear terrain.

Declaring both courses in one format also enforces FR-067's requirement that the
warm-up rehearse everything except the terrain: same schema, same validator, same
physics constants, different points.

### Alternatives considered

- **Procedural generation from the seed** — rejected. Tempting given the seed is
  already shared, but it makes FR-089 a property to be proven over a generator
  rather than checked over data, and a bad seed would produce an unfinishable
  official course with no review step to catch it.
- **Separate formats for warm-up and official** — rejected. Doubles the validator
  and invites the two to drift apart, which is exactly what FR-067 forbids.

---

## R5. Shared storage: claims, run counts, and commit-once

**Resolves**: FR-021, FR-037, FR-046, FR-070, FR-072.

### Decision

**Supabase** — hosted Postgres with Row Level Security and Realtime. The rules that
matter are database invariants, not client code:

| Rule | Mechanism | Requirement |
|---|---|---|
| One official score per entry, ever | `UNIQUE (draft_id, entry_id)` on `official_score`; insert-only RLS, no UPDATE or DELETE grant | FR-017, FR-018 |
| Name claimed by exactly one player | `UNIQUE (draft_id, lower(name))`; loser gets a constraint violation | FR-003, FR-012 |
| Roster cap of 16 | Trigger rejecting inserts past the cap | FR-002, FR-072 |
| Commit time not from the player's device | `commit_at timestamptz DEFAULT now()`, not client-writable | FR-037 |
| Deadline enforced server-side | Policy rejects inserts when `now() > draft.deadline` | FR-043 |
| Organizer-only actions | Separate policy keyed on an organizer secret, absent from the player bundle | FR-006, FR-074 |

### Rationale

FR-018 forbids any player-accessible path to retake or edit a committed score. That
does **not** dissolve under [ADR-0004](../../docs/adr/0004-accept-client-reported-scores.md):
trusting players not to forge a *value* is a different thing from letting the client
issue an UPDATE. A unique constraint plus insert-only grants makes the one-run rule
a property of the database that no client bug or curious player routes around.

Server-assigned timestamps matter more than they look — FR-037 makes commit time
the tiebreaker for the bed order, so a wrong device clock could otherwise change who
sleeps where.

Self-serve roster creation (FR-070) makes the cap a server concern rather than a UI
one, since the player bundle can no longer be trusted to enforce it.

### Alternatives considered

- **Cloudflare Durable Objects** — technically the better fit; one object per draft
  serialises every write and makes races impossible by construction rather than by
  constraint. Rejected on cost and ceremony: a paid Workers plan and more
  infrastructure code than a weekend draft justifies. Revisit if this serves many trips.
- **Firebase Realtime Database** — workable, but security-rule expressions are
  harder to review than SQL constraints, and "insert once, never update" is more
  awkward to express and to prove.
- **Any device-local store as source of truth** — rejected outright by FR-021.
  Named because it is the tempting shortcut: `localStorage` would silently hand
  every player a fresh official run per device.

---

## R6. Rendering: a 2D platformer that looks like 1986

**Resolves**: FR-076, FR-051 through FR-057.

### Decision

Render the world into a **fixed 320 × 180 internal buffer** in a side-on
orthographic view, then integer-upscale with nearest-neighbour filtering.
Post-processing — scanlines, halftone, chromatic fringing, neon bloom — runs as
WebGL fragment shaders on that small buffer. **PixiJS v8** supplies the WebGL
layer, filter pipeline, and canvas fallback.

### Rationale

The aesthetic and the frame budget point the same way, which is rare enough to
exploit. A 1986 look *wants* a chunky pixel grid; a mid-range phone *wants* to
shade 57,600 pixels rather than 2.3 million. Full-screen bloom is expensive at
native resolution and nearly free here.

It also does real work for SC-006. A fixed internal buffer means phone and desktop
see the same pixel grid and, critically, **the same amount of course ahead** — the
player's reaction window is identical on both. Without it, a widescreen desktop
would show more of the run and the parity requirement would be a permanent tuning
problem instead of a property of the renderer. This matters more after the
clarifications than it did before: FR-088 makes release timing the core skill, and
timing skill is exactly what more lookahead would buy.

PixiJS is ~400 KB gzipped, renderer-only, and imposes no game loop, scene
lifecycle, or physics — all of which would fight R2's pure-function simulation.

### Alternatives considered

- **Phaser 3** — rejected. Capable, but brings its own loop and float-based
  Arcade/Matter physics that are not built for bit-determinism. We would spend the
  project disabling its best features.
- **Canvas 2D only** — rejected. Zero dependencies and perfectly deterministic, but
  halftone and bloom become per-pixel JavaScript and will not hold the budget.
- **Raw WebGL2** — rejected. Saves 400 KB, costs weeks of atlas and batching
  plumbing PixiJS has already debugged.
- **Scaling the buffer to the viewport** — rejected. Breaks the equal-lookahead
  property that makes SC-006 tractable.

---

## R7. Offline durability, audio, and tooling

### Offline

A **service worker** precaches the app shell, course data, tuning data, and assets
so a run is fully playable with no connectivity (FR-049). Commits that cannot reach
Supabase go to an **IndexedDB outbox** and retry with exponential backoff until the
server confirms (FR-046, FR-048).

The outbox is device-local storage, which FR-021 forbids for run state. The
distinction is deliberate and must survive review: the outbox is a **transport
buffer for a write already made**, never a source of truth for whether a run
happened. Reading run counts or claims from it is a defect. The UI shows *pending*
until the server confirms, and never claims a leaderboard place before then (FR-047).

### Audio

Synthesise the chiptune and synthwave score at runtime with the **Web Audio API** —
oscillators, envelopes, a noise channel for percussion — rather than shipping audio
files. Original by construction (FR-053), kilobytes instead of megabytes against the
payload budget, and exactly how the music of the period was actually made. Nodes are
created only after the first deliberate gesture, satisfying FR-054 and browser
autoplay policy at once.

### Tooling and tests

TypeScript in strict mode, built with Vite. **Vitest** for unit, simulation, and
course-validator tests; **Playwright** for cross-browser determinism, performance,
and end-to-end runs. Hosted on **GitHub Pages** via GitHub Actions — the repository
is already there, so hosting introduces no new account or vendor.

Monkey testing (FR-062) fuzzes randomised input sequences across thousands of seeds
under Vitest, asserting no throw, no non-finite state value, and no tick over a
wall-clock ceiling. It is a pure-function fuzz of `step()`, possible only because R2
keeps the simulation free of DOM and I/O.

### Alternatives considered

- **Shipping tracker modules or audio files** — rejected. Real files consume most of
  the payload budget and raise a provenance question runtime synthesis does not have.
- **Background Sync API for the outbox** — rejected as primary. Unsupported on iOS
  Safari, a large share of the actual roster. A plain retry loop works everywhere;
  Background Sync can be layered on later.
- **Netlify or Cloudflare Pages** — both fine. GitHub Pages wins only on introducing
  no new account; switching later is a CI change, not a rewrite.
