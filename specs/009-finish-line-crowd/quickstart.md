# Quickstart: Finish Line

## 1. Nothing about a run changed

```bash
npm run map && cp dist/course-map.summary.txt /tmp/before.txt   # on the commit before
# ... after the feature:
npm run map && diff /tmp/before.txt dist/course-map.summary.txt
```

Expected: the riders' lines are identical (outcome, time, score, shelves). The only
tolerated difference is lead time on hazards within 213 units of L, where the camera
now sees the drawn run-out, and B1 to B10 must still pass.

```bash
npx vitest run && npm run test:determinism
```

Expected: all green, determinism goldens unmodified.

## 2. The finish, on the built artifact

```bash
npm run build && npm run test:build -- tests/e2e-build/finish.spec.ts
```

Expected: E1 passes. A practice run replayed to the line shows FINISH over the
mountain while the tuck key is held, then the results with a panel wipe and the
pilot's score.

## 3. The contracts

```bash
npx vitest run tests/unit/finish-*.test.ts tests/sim/finish-visible.test.ts
```

## 4. The course map

Run `/course-map`. The finish marker appears at L on both courses.

## 5. Play pass (Principle VIII, SC-100)

Hand over `npm run build:artifact`, with sound on, and ask the maintainer to finish:

- both courses;
- once with reduced motion on (SC-099);
- once pressing a key during the hold (skip), and once holding tuck through the line
  (must not skip).

Record the verdict verbatim in spec.md.

## Stated gaps (Principle VI)

- Sound is not asserted in a browser. That the cheer plays at the crossing is covered
  by a unit test of the cue call and by the play pass.
- No measuring pilot finishes on the official shelf. That case is covered by F4's
  synthetic state and by the play pass.
