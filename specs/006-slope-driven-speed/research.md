# Phase 0 Research: Speed Comes From the Mountain

**Feature**: [spec.md](./spec.md) | **Date**: 2026-09-10

Every number was produced by driving the candidate model with the repository's own
`sqrtDet` and `data/tuning.json`, at the simulation's real 60 Hz tick. Reproduced in
[quickstart.md](./quickstart.md).

---

## R1 — The model, and why this one

**Decision**: `a = gravity × (uy − friction × ux) − drag × v²`, integrated explicitly,
with `drag` taking a standing or a tucked value.

**Rationale**: This is the textbook body-on-an-incline with quadratic air resistance,
and it is what a game engine computes when you put a rigid body on a ramp and give it
a drag coefficient. Three properties make it the right one _here_ rather than merely
the familiar one:

1. **It needs no new primitive.** `slopeAt` already returns an exact unit downhill
   vector, so `uy` **is** sin θ and `ux` **is** cos θ. The model is then addition,
   subtraction and multiplication over numbers the simulation already holds — inside
   the constitution's rule that simulation code may not call trigonometric,
   exponential, logarithmic or power functions. A model expressed in angles rather
   than in the unit vector would have needed `Math.sin`, and would have been illegal.
2. **Terminal velocity is emergent, not clamped.** Quadratic drag rises faster than
   gravity can push, so speed self-limits. The player meets a pitch and finds out what
   it is worth. Nothing has to be capped to keep it sane.
3. **The tuck becomes the real mechanism.** Lower drag, not higher target. A tuck
   makes you smaller so the air does less to stop you — which is what a tuck is.

**Alternatives considered**: _Linear drag_ (`−c·v`) — rejected, terminal velocity then
scales linearly with slope and the spread is far too flat to feel. _Gravity with no
drag_ — rejected, speed rises without bound and every course becomes unrideable at the
bottom. _A tuned lookup curve of gradient → speed_ — rejected, it is the target-and-
clamp problem again with more numbers, and Principle III's "tuning lives in data"
does not mean "invent the physics and store it".

---

## R2 — Constants, anchored so the middle of the game does not move

**Decision**: `friction = 0.02`, `dragStanding = 0.01270`, `dragTucked = 0.00487`.

**Rationale**: The two drag values are not chosen, they are _solved_, from the
requirement that **gradient 0.30 — the sustained pitch of both courses — produces
exactly today's 2.60 standing and 4.20 tucked.** Anchoring there is what keeps this a
change to the extremes rather than a change to everything: the middle of both courses
rides as it always did.

The drag ratio falls out at 4.20²/2.60² = **2.61**, meaning a tuck cuts drag to 38% of
standing. That is a plausible figure for a real tuck and it was not aimed at.

**Measured**, terminal speed as standing / tucked:

| Gradient          | 0.08          | 0.12          | 0.20          | 0.30          | 0.40          | 0.52          | 0.64          |
| ----------------- | ------------- | ------------- | ------------- | ------------- | ------------- | ------------- | ------------- |
| friction 0.00     | 1.37/2.21     | 1.67/2.70     | 2.15/3.47     | 2.60/4.20     | 2.96/4.77     | 3.29/5.32     | 3.57/5.77     |
| **friction 0.02** | **1.23/1.98** | **1.58/2.56** | **2.11/3.41** | **2.60/4.20** | **2.98/4.82** | **3.34/5.40** | **3.64/5.87** |
| friction 0.04     | 1.04/1.68     | 1.47/2.37     | 2.06/3.33     | 2.60/4.20     | 3.01/4.87     | 3.40/5.49     | 3.71/6.00     |

Today, every one of those cells is 2.60 / 4.20.

**Why 0.02 rather than a realistic 0.05.** Waxed ski on cold snow measures roughly
0.03–0.1. At 0.05 the gentlest terrain drops to 0.82 standing, which is a crawl, and
the stall threshold climbs to a gradient the coached section of feature 005 sits very
close to. 0.02 keeps gentle terrain flowing and still delivers a 2.96× spread. It is
a game value and the spec says so.

---

## R3 — Explicit integration is stable, and better than the clever alternative

**Decision**: Integrate explicitly — `v += a − k·v²`. Do not use a semi-implicit
damping step.

**Measured**, from a standstill over 400 ticks with standing drag:

| Gradient | Terminal | Explicit settles | Wobble | Semi-implicit settles |
| -------- | -------- | ---------------- | ------ | --------------------- |
| 0.300    | 2.600    | 2.600            | 5e-13  | 2.557                 |
| 0.644    | 3.636    | 3.636            | 0      | 3.553                 |
| 1.000    | 4.179    | 4.179            | 0      | 4.070                 |
| 1.732    | 4.645    | 4.645            | 0      | 4.510                 |

**Rationale**: The explicit form lands exactly on terminal velocity with no
oscillation and no overshoot, at every legal gradient including CV-2's maximum of
1.732 — the case that would break a naive integrator if anything did. The
semi-implicit form, which exists to buy stability, is not needed and costs accuracy:
it settles 1.5–3% _below_ terminal at every gradient, so every speed in the game would
be quietly wrong in a way no one could see. Simpler and more accurate is an easy call.

Note the ceiling this buys for free: even at 60°, standing terminal is 4.645. Nothing
in the model can run away.

---

## R4 — The tuck takes twice as long to bite, and that is the feel risk

**Measured** at gradient 0.30, holding the crouch from standing speed 2.60 toward the
tucked terminal 4.20:

| Tick  | 1    | 2    | 3    | 5    | 10   | 20   | 30   | 45   | 60   | 90   |
| ----- | ---- | ---- | ---- | ---- | ---- | ---- | ---- | ---- | ---- | ---- |
| Speed | 2.65 | 2.70 | 2.75 | 2.85 | 3.07 | 3.42 | 3.67 | 3.91 | 4.04 | 4.15 |

90% of the gain arrives at **60 ticks (1.00 s)**. Today's `tuckAccel` of 0.055 gets
there in **30 ticks (0.50 s)**.

**Decision**: Ship the physics value and let the player judge it. FR-221 makes it a
named tuning value with a tolerance so the playtest can move it without a code change.

**Rationale**: This is the one place where realism and the existing feel visibly
disagree, and the constitution has already ruled on the general case — FR-084 says
crispness wins where it conflicts with realism. But it is not obviously in conflict:
the _pose_ still changes within `crouchTransitionTicks` = 4, so input-to-visible-
response is untouched and Principle III's 2-frame rule is not threatened. What is
slower is the payoff, and a real tuck does take about a second to tell.

The honest position is that this cannot be settled by measurement — Principle VIII
says the player's reading wins and the measurement is what gets revised. It is
therefore the **first question of the playtest**, not a decision this document makes.

**Alternatives considered**: a floor on acceleration while tucked (`max(a, tuckAccel)`)
would restore the old snap at the cost of putting the invented mechanism back inside
the real one — held in reserve, to be used only if the playtest asks for it, and only
as a named tuning value.

---

## R5 — Below the friction threshold the player stops, and a floor is not enough

**Measured**: net acceleration is zero when `uy = friction × ux`, i.e. gradient =
friction = 0.02 (1.15°). Below that the model decelerates the player to a standstill.

CV-2 caps gradient from above at 1.732 and **nothing caps it from below**. A course
containing a segment gentler than ~1.15° would strand a player permanently, with no
input available to recover — there is no brake and no pedal.

**Decision**: Both guards, and the validator is the real one.

- A lower bound in tuning (FR-219), so a player is never stranded whatever the data
  says. This is FR-077's "no brake, never below base", preserved.
- **A new validator rule (FR-220)** rejecting any segment too shallow to overcome
  friction with margin. A course that could strand a player must not be publishable.

**Rationale**: A floor alone would hide the defect rather than prevent it — the player
would creep along at the floor speed through a section the designer thought was
rideable, which is the kind of thing that ships. The validator makes it impossible to
author. This is the same argument CV-4 already makes about release windows.

Neither existing course is affected: the official course's shallowest gradient is
0.200 and the warm-up's is 0.230, both an order of magnitude above the threshold. The
rule is a guard for future course authoring — including feature 005's coached section,
which at 0.08 sits comfortably clear but is the gentlest terrain anyone has yet
proposed.

---

## R6 — Every launch in the game moves

**Measured**, the official course's five kickers. Impulse is `power × carried speed`;
today carried speed is 4.20 at every one of them:

| Kicker x | Power | Gradient | New tucked speed | New impulse | Today | Change   |
| -------- | ----- | -------- | ---------------- | ----------- | ----- | -------- |
| 1400     | 1.90  | 0.268    | 3.97             | 7.54        | 7.98  | −6%      |
| 5200     | 1.50  | 0.575    | 5.63             | 8.44        | 6.30  | **+34%** |
| 7852     | 0.70  | 0.200    | 3.41             | 2.39        | 2.94  | −19%     |
| 9188     | 0.75  | 0.200    | 3.41             | 2.56        | 3.15  | −19%     |
| 11000    | 1.90  | 0.200    | 3.41             | 6.47        | 7.98  | −19%     |

All five stay under `kickerImpulseMax` = 10.0, so nothing saturates. But every one has
moved, and CV-13 certifies each shelf as _enterable by a player carrying speed and not
otherwise_. Both halves of that can now fail: the kicker at x=11000 is 19% weaker and
may no longer reach its shelf; the kicker at x=5200 is 34% stronger and may overshoot
or make its shelf reachable too easily.

**Decision**: Re-tune every `power` against the gradient its kicker actually sits on,
and re-run CV-13 over both courses. This is FR-224, and it is the largest piece of
work in the feature — larger than the physics change itself.

**The pleasing part**: the kicker at x=5200, which sits on the course's steepest pitch
at 0.575, is the one that gets dramatically stronger. That is the "big kicker after
the steep bit" the feature description asks for, appearing on its own out of the model
rather than being authored.

---

## R7 — What this does to feature 005

**Measured**: the coached section at gradient 0.08 runs at **1.23** standing rather
than 2.60. Horizontal progress falls from 156 to ~74 units/second, so the 213.3-unit
lookahead becomes **2.90 s** of on-screen reading time, up from 1.38 s.

**Consequence**: feature 005's research R1 and R2 were both correct measurements of a
game where speed was pinned, and both stop being true here.

- **R1 reverses.** A gentler slope now genuinely is slower, in the direction 005
  always assumed. Its FR-187 amendment — "the gentle gradient is for how it reads, not
  what it does" — becomes wrong again in the opposite direction.
- **R2's constraint lifts.** The 389-unit cue lead was forced by there being only
  1.38 s available. With 2.90 s, FR-191 as originally written — badge appears while its
  object is visible — is comfortable.

**Decision**: Do not silently carry 005's amendments forward. If both features ship,
005's FR-187 and FR-191 are revisited against these numbers. Recorded in 005's own
research and plan rather than only here, so whichever document a reader opens tells
the truth.
