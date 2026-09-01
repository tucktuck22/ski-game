# Phase 0 Research: Shredpocalypse '86

**Date**: 2026-09-01 | **Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

Five unknowns block planning. Four are `NEEDS CLARIFICATION` in Technical Context;
the fifth is `TODO(TARGET_PLATFORM_BASELINE)` in the constitution, which the
constitution itself says must be resolved here.

---

## R1. Target platform, reference hardware, and performance budgets

**Resolves**: `TODO(TARGET_PLATFORM_BASELINE)`

### Decision

Target the **evergreen mobile web**: Chromium, Firefox, and Safari on iOS 16+ and
Android 10+, plus the same engines on desktop. No install, no app store, no native
build.

**Reference hardware** is a 2022-era mid-range phone — Pixel 6a / Galaxy A54 /
iPhone SE 3rd gen class. Every budget below is stated against that device, with a
CI proxy that approximates it without a device lab: headless Chromium under
**4× CPU throttling**, and Fast 3G network emulation for load measurements.

| Budget | Value | Source requirement |
|---|---|---|
| Simulation step cost | ≤ 2.0 ms per 60 Hz tick under 4× throttle | FR-025 |
| Frame time | ≤ 16.7 ms at p95; ≥ 50 fps sustained through a full run | SC-009 |
| Input to visible response | ≤ 2 simulation frames (33.4 ms) | FR-031 |
| Initial payload | ≤ 2 MB gzipped, all assets included | SC-001 |
| Time to interactive | ≤ 5 s on Fast 3G, cold cache | SC-001 |
| Peak JS heap | ≤ 150 MB | Principle II |

### Rationale

The product is a link dropped into a group chat. Anything requiring an install,
an account, or a 20 MB download loses players before the first run, and SC-001
allows 60 seconds from tap to first practice run.

The reference device is chosen from who actually plays: most of an eight-person
ski trip will open this on a phone in a lodge on bad wifi, not on a gaming desktop.
Budgeting against a desktop and hoping phones keep up would invert SC-006's
parity requirement.

4× CPU throttling is a proxy, not a measurement. It is honest about that: it
catches regressions and order-of-magnitude mistakes in CI, and it does not replace
the human playtest that Definition of Done item 6 requires on a real phone.

### Alternatives considered

- **Unity WebGL** — rejected. Typical builds start around 10–20 MB and load slowly
  on mobile Safari. It breaks the payload and time-to-interactive budgets before a
  line of game code is written.
- **Godot 4 web export** — rejected. Smaller than Unity but still multi-megabyte
  WASM, with known mobile-Safari audio and threading friction. Too much risk for a
  link-and-play product.
- **Native iOS/Android** — rejected. App stores and installs are fatal to "tap the
  link in the group chat," and it doubles the platform surface for eight players.

---

## R2. Determinism strategy: how the simulation stays bit-identical

**Resolves**: NEEDS CLARIFICATION on arithmetic. Satisfies constitution Technical
Standards ("Floating-point behavior MUST be specified and pinned, or fixed-point
arithmetic used") and FR-026.

### Decision

Use **IEEE-754 float64 restricted to the exactly-specified operations** — `+`, `-`,
`*`, `/` — and forbid everything else in simulation code.

ECMAScript mandates IEEE-754 doubles and those four operators are correctly
rounded, so they produce bit-identical results on every conforming engine and CPU.
The non-determinism people associate with floating point in JS comes from
`Math.sin`, `Math.cos`, `Math.pow`, `Math.exp`, `Math.log`, `Math.atan2` and
friends, whose results are explicitly implementation-approximated and **do** differ
between V8, SpiderMonkey, and JavaScriptCore.

Enforcement is three-layered, because a rule nobody can violate is worth more than
a rule everyone remembers:

1. **Lint**: `no-restricted-globals` / `no-restricted-properties` bans `Math.*`,
   `Date.*`, and `performance.*` inside `src/sim/**`. Trigonometry comes from a
   generated lookup table checked into the repo as data. Square roots are avoided
   by comparing squared magnitudes; where genuinely needed, a deterministic
   integer Newton iteration is used rather than `Math.sqrt`.
2. **Golden-run test**: a recorded seed plus input trace must reproduce an exact
   score and an exact end-state hash. Run in CI on Chromium, Firefox, **and**
   WebKit via Playwright — the same assertion across three engines is the actual
   proof, not the argument above.
3. **Structural**: the simulation is a pure `step(state, input) -> state` function
   in `src/sim/`, with no imports from rendering, audio, storage, or the DOM.

### Rationale

Fixed-point was the obvious candidate and is worse here in practice. Q16.16
multiplication needs a 64-bit intermediate, which JavaScript does not have —
`int32 × int32` overflows the 2^53 exact-integer range of a double, so every
multiply becomes either a `BigInt` (slow enough to threaten the 2 ms step budget)
or a hand-split high/low routine that is its own bug farm. Once the lint rule and
the three-engine golden test exist, fixed-point buys no additional safety for
considerably more friction in the code that most needs to stay readable.

**Residual risk, stated plainly**: `Math.sqrt` is correctly rounded on every
mainstream engine, but ECMAScript's guarantee for it is weaker than for the four
arithmetic operators. This is why it is banned outright rather than merely
discouraged. If a future change needs it, the three-engine golden test is what
decides — not this document.

### Alternatives considered

- **Q16.16 fixed point** — rejected above.
- **Float64 with `Math.fround` normalisation** — rejected. Narrowing to float32 at
  boundaries reduces precision without removing the transcendental-function
  problem, which is the actual source of divergence.
- **Trusting float64 without enforcement** — rejected. It works right up until
  somebody writes `Math.sin` in a physics tweak at 1 a.m., and then silently
  produces different scores per browser, which is exactly the failure Principle V
  exists to prevent.

---

## R3. Rendering: hitting the 1986 look inside a phone's frame budget

### Decision

Render the world into a **fixed 320 × 180 internal buffer**, then integer-upscale
to the display with nearest-neighbour filtering. Post-processing — scanlines,
halftone screen tone, chromatic fringing, neon bloom — runs as WebGL fragment
shaders on that small buffer. **PixiJS v8** provides the WebGL layer, filter
pipeline, and canvas fallback.

### Rationale

The aesthetic and the performance budget point the same way, which is rare and
worth exploiting. A 1986 look *wants* a low, chunky pixel grid; a mid-range phone
*wants* to shade 57,600 pixels instead of 2.3 million. Full-screen bloom is
expensive at native resolution and nearly free at 320 × 180.

It also strengthens SC-006. Everyone — phone and desktop — sees the identical pixel
grid and the identical amount of course ahead of them. Without a fixed internal
resolution, a widescreen desktop would show more of the mountain than a phone, and
the parity requirement would be a tuning problem forever instead of a property of
the renderer.

PixiJS is ~400 KB gzipped, renderer-only, and does not impose a game loop, scene
lifecycle, or physics engine — all of which would fight R2's pure-function
simulation.

### Alternatives considered

- **Phaser 3** — rejected. A capable game framework, but it brings its own loop and
  float-based Arcade/Matter physics that are not built for bit-determinism. We
  would spend the project disabling its best features.
- **Canvas 2D only** — rejected. Zero dependencies and perfectly deterministic, but
  halftone and bloom become per-pixel JavaScript, which will not hold 2 ms.
- **Raw WebGL2** — rejected. Saves 400 KB and costs weeks of texture-atlas and
  batching plumbing that PixiJS has already debugged.

---

## R4. Shared storage: claims, run counts, and commit-once

### Decision

**Supabase** — hosted Postgres with Row Level Security and Realtime — as the shared
store. The rules that matter are enforced as *database invariants*, not as client
code or policy:

| Rule | Mechanism | Requirement |
|---|---|---|
| One official score per roster entry, ever | `UNIQUE (draft_id, roster_entry_id)` on `official_score`, insert-only RLS, no UPDATE or DELETE grant | FR-017, FR-018 |
| Name claimed by exactly one player | `UNIQUE (draft_id, name)` plus conditional insert; loser gets a constraint violation | FR-008, FR-012 |
| Commit timestamps not from the player's device | `commit_at timestamptz DEFAULT now()`, column not writable by the client | FR-037 |
| Deadline enforced server-side | Insert rejected by policy when `now() > draft.deadline` | FR-043 |

### Rationale

FR-018 says no player-accessible path may retake or edit a committed score. That is
not a cheating-detection requirement and it does **not** dissolve under
[ADR-0004](../../docs/adr/0004-accept-client-reported-scores.md) — trusting players
not to forge a score is a different thing from letting the client issue an UPDATE.
A unique constraint plus insert-only grants makes the one-run rule a property of
the database that no client bug or curious player can route around, while the
*value* of the score remains trusted exactly as decided.

Server-assigned timestamps matter more than they look. FR-037 makes commit time
the tiebreaker for the bed order, so a player with a wrong device clock — or a
player who notices the tiebreaker — could otherwise change the outcome.

Supabase's free tier covers eight players on one weekend with enormous headroom,
Realtime provides the ≤ 10 s leaderboard propagation FR-042 asks for without
polling, and the anon key being public is fine: RLS is doing the work, and there is
no account system or personal data to protect.

### Alternatives considered

- **Cloudflare Durable Objects** — technically the best fit. One object per draft
  gives serialised single-threaded access, making every race impossible by
  construction rather than by constraint. Rejected on cost and ceremony: it
  requires a paid Workers plan and more infrastructure code than a weekend draft
  for eight friends justifies. Worth revisiting if this ever serves many trips.
- **Firebase Realtime Database** — workable, but security-rule expressions are
  harder to review than SQL constraints, and "insert once, never update" is
  meaningfully more awkward to express and to prove.
- **Any device-local store as source of truth** — rejected outright by FR-021.
  Explicitly noted because it is the tempting shortcut: `localStorage` is trivial
  and would silently hand every player a fresh official run per device.

---

## R5. Offline commits, audio, and the remaining implementation questions

### Offline durability

A **service worker** precaches the app shell, tuning data, and assets so a run is
fully playable with no connectivity (FR-049). Committed scores that cannot reach
Supabase go to an **IndexedDB outbox** and retry with exponential backoff until the
server confirms (FR-046, FR-048).

The outbox is device-local storage, which FR-021 forbids for run state. The
distinction is deliberate and must survive review: the outbox is a **transport
buffer for a write already made**, never a source of truth for whether a run
happened. Reading run counts or claims from it is a defect. The UI shows *pending*
until the server confirms and never claims a place on the leaderboard before then
(FR-047).

### Audio

Synthesise the chiptune and synthwave score at runtime with the **Web Audio API** —
oscillators, envelopes, a noise channel for percussion — rather than shipping
audio files. This is original by construction (FR-053), costs kilobytes instead of
megabytes against the payload budget, and is exactly how the music of the period
was actually made. Audio nodes are created only after the first deliberate user
gesture, which satisfies FR-054 and the browsers' own autoplay policies at once.

### Language, tooling, and tests

TypeScript in strict mode, built with Vite. **Vitest** for unit and simulation
tests, **Playwright** for cross-browser determinism, performance, and end-to-end
runs. Hosted on **GitHub Pages** via GitHub Actions — the repository is already
there, so no additional account or vendor is introduced for hosting.

Monkey testing (FR-062) runs the simulation headless under Vitest with randomised
input sequences across thousands of seeds, asserting no throw, no non-finite state
value, and no tick exceeding a wall-clock ceiling. It is a pure-function fuzz test
of `step()`, which is only possible because R2 keeps the simulation free of DOM
and I/O.

### Alternatives considered

- **Shipping tracker modules or audio files** — rejected. Real files cost most of
  the 2 MB payload budget and raise a provenance question that runtime synthesis
  does not have.
- **Background Sync API for the outbox** — rejected as the primary mechanism.
  Unsupported on iOS Safari, which is a large share of the actual roster. A plain
  retry loop works everywhere; Background Sync can be added as an enhancement.
- **Netlify or Cloudflare Pages hosting** — both fine. GitHub Pages wins only on
  introducing no new account, and switching later is a CI change, not a rewrite.
