# Quickstart: Verifying the Drawn Skier

How to prove this feature works. Ordered so the cheapest checks fail first and the
one that needs a human is last.

**Nothing here runs until the art is committed.** The sheet arrived as an image in
conversation, not in the repository (spec Dependencies, research R5). Step 0 is not
optional.

---

## Step 0 — Prerequisites

```bash
npm ci
```

The art must be in place:

| Path                            | What                                                                | Requirement    |
| ------------------------------- | ------------------------------------------------------------------- | -------------- |
| `public/sprites/skier.png`      | Shipped sheet. 8-bit indexed PNG, colour-type 3, nine-colour `PLTE` | FR-159, FR-162 |
| `assets/sprites/skier.source.*` | Retained editable source, original layout                           | FR-171         |
| `assets/sprites/README.md`      | Provenance: names the work, establishes it as original and owned    | FR-170         |

The shipped sheet is the **re-cut** grid (FR-160), not the supplied image — the
source numbers two cells `6` and two cells `13` and leaves five blank. The supplied
layout is what `skier.source.*` retains.

---

## Step 1 — Static checks

```bash
npm run lint && npx tsc --noEmit
```

Catches the compile-time half of the determinism guarantee: `selectPose` takes
`Readonly<RunState>`, so any write to simulation state from the render layer fails
here rather than at review (research R6).

> **`npm run lint` is red on `main` before this feature starts.** With the committed
> lockfile installed, `prettier --check .` reports 167 files, most of them untouched
> by this work — `package.json` asks for prettier `^3.3.3` and the lockfile resolves
> `3.9.6`, which formats differently. See plan.md's stated gaps. Fix it as its own
> change; do **not** fold a 167-file reformat into a sprite feature, and do not report
> CI green until it is resolved (Definition of Done item 8).

---

## Step 2 — Unit suite

```bash
npm run test:unit
```

| Test                                        | Asserts                                                                                                    | Requirement            |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------- |
| `sprite-palette.test.ts`                    | Every PNG under `public/sprites/` is colour-type 3 and every `PLTE` entry is one of the nine tokens        | FR-162, **SC-059**     |
| `palette.test.ts`                           | `PALETTE` has exactly nine tokens; skin separates from `orange` under protanopia, deuteranopia, tritanopia | FR-179, **FR-182**     |
| `sprite-manifest.test.ts`                   | Schema, unique ids, bare filenames, integer geometry, all required skier poses present                     | FR-160, FR-165, FR-173 |
| `skier-pose.test.ts`                        | Every row of [`contracts/pose-selection.md`](./contracts/pose-selection.md), plus its edge cases           | FR-165–FR-168, FR-184  |
| `skier-pose.test.ts` (reduced-motion block) | The full pose table returns **identical** poses under `REDUCED_MOTION`                                     | FR-174, **SC-060**     |

> If the skin token fails the CVD check, **the art changes, not the threshold**
> (research R5). The style bible records `orange` already being darkened from
> `#FF7A29` for exactly this reason.

---

## Step 3 — Determinism unchanged

```bash
npm run test:sim
npm run test:determinism    # Chromium, Firefox, WebKit
```

**Expected: identical results to the pre-feature build.** `RunState` gains no field,
so the state hash cannot have changed and these compare the same bytes as before
(FR-164, **SC-055**).

This is the check that would catch the one catastrophic way to get this feature
wrong: putting pose state into the simulation.

---

## Step 4 — The built artifact, at the production base path

```bash
npm run test:build
```

Principle VI. Drives `tests/e2e-build/sprite-*.spec.ts` against the **built**
artifact served at `/ski-game/`, where `import.meta.env.BASE_URL` is the production
value and base-path defects are visible.

Two scenarios, and the second matters more:

1. **Sheet loads.** The request for `/ski-game/sprites/skier.png` returns 200 and a
   run renders. Proves FR-173 — the same silent-404 class that reached players in
   this project's first deployment week.
2. **Sheet blocked.** The route is aborted; a full run is then played and a score
   committed. Proves FR-172 and **SC-056** — the fallback is exercised deliberately,
   not assumed.

> Stated gap: this job is Chromium-only, and `vite preview` 404s the bare
> `/ski-game` with no trailing slash where GitHub Pages redirects it. Both are
> pre-existing limits of the smoke gate (constitution deviation 1), inherited here
> rather than introduced.

---

## Step 5 — Frame budget

```bash
npm run build
npm run preview
```

Then measure frame time through a full run at `/ski-game/` and compare with the same
measurement on the pre-feature build. **Expected: no worse.** One `drawImage`
replaces five `fillRect`s, a `strokeRect` and a filled path, so neutral-to-favourable
is the expectation — but FR-177 asks for non-regression, not improvement, and that is
what to record.

> **This step is manual and has no gate.** `package.json` declares `test:perf` →
> `tests/e2e/performance.spec.ts` and **that file does not exist**. This is
> constitution open deviation 3, which this feature does not close. Per Definition of
> Done item 7, name the command and the environment in the change description.
> "Verified" without them is not a claim. **SC-057.**

Also record the payload delta for **SC-058**: compare `dist/` totals before and
after; the ceiling is 2 MB gzipped (FR-176).

---

## Step 6 — Play it

```bash
npm run dev
```

The step no gate replaces. Definition of Done item 6, **SC-061**.

Play a full run and confirm, without reading the HUD:

- [ ] Cruising reads as carving, and the character sits **on** the snow — no ski tip
      floating or buried at any point on the run (**SC-062**, FR-183)
- [ ] Holding crouch folds the character and holds it; releasing extends him (FR-166)
- [ ] Launch, air and tuck are three distinguishable things (FR-165)
- [ ] Landing compresses and recovers rather than snapping upright (FR-168)
- [ ] Landing on a ramp and relaunching immediately does **not** leave a stuck absorb
      pose (FR-168, the ramp-relaunch edge case)
- [ ] A spin reads as a spin; a spun-out landing reads as a crash, not a landing
      (FR-167)
- [ ] Riding the upper track, the character sits on the shelf (spec edge case)
- [ ] No flicker or alternation as the slope changes, especially at terrain vertices
      (FR-184)
- [ ] The character is never mistakable for a hazard (FR-163, P-4)

Then show the first frame of a run to someone who has not seen the game:

- [ ] They identify the character as a skier, and pick him out from the hazards,
      within one second (**SC-054**)
- [ ] The character's **silhouette** differs from every hazard silhouette — not only
      its colour. Trees, deadfall, rocks and ice must stay distinct from the player
      with hue removed entirely; the CVD separation asserted in step 2 is the second
      line of defence, not the first (**FR-175**, P-5)

Then, with reduced motion enabled (`prefers-reduced-motion`, or the in-game toggle):

- [ ] Every pose above still appears (FR-174)
- [ ] Decorative idle movement does not (FR-174)

**Record the findings against this spec**, per the constitution's playtest cadence.

---

## Step 7 — Review checklist

Before the change is done:

- [ ] `assets/style-bible.md` section 1 has nine rows, and the new token has a rule
      assigning its role and forbidding it elsewhere (FR-181)
- [ ] `docs/adr/0010-a-ninth-colour.md` exists and explains why eight stopped being
      true (FR-180)
- [ ] `assets/sprites/README.md` records provenance; the editable source is committed
      (FR-170, FR-171)
- [ ] The sheet cites the style-bible rules it satisfies (FR-052)
- [ ] No `data/tuning.json` value changed (FR-161)
- [ ] No `RunState` field added or altered (FR-164)
- [ ] CI green on the head commit — checked, not assumed (Definition of Done item 8)

**All three of the palette amendment's parts ship together or none do** (FR-180): the
bible edit, the ADR, and the tightened palette test. A bible that disagrees with a
shipped asset is a defect under Principle I.
