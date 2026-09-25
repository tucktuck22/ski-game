# Baseline: rules 2.0.0, as shipped

**Task**: T001 · **Recorded**: 2026-09-24 · **Courses**: `git show HEAD:data/courses/*.json` at
commit `7c31b23` · **Camera**: the 2.0.0 camera, i.e. the air lift only and no look-down

Every "≥ baseline" and "within 2%" assertion in `tests/sim/reaction-budget.test.ts`
compares against this file. The measuring rides are defined in `tests/sim/pilots.ts`
and the measures in `tests/sim/reaction.ts`.

## How the measure differs from research, and why

Research R1 measured on a single probe rider. Implementing it as a real pilot
(T003) exposed two things the probe never checked:

1. **That rider did not stay low.** Standing up is itself a launch (FR-078), and a
   hop lands faster than it left, because there is no drag in the air. A rider who
   stood 260 units before a ramp still reached every ramp fast enough to be thrown
   onto all three shelves. The probe never counted shelves, so its "low line" was
   partly a high line. `'low-line'` now stands 500 units out. From 450 onward it
   stays off every shelf except the Cornice, which follows the steepest box too
   closely for any stand-up point to avoid.
2. **No single rider is the worst case.** On the shipped course the worst box
   belongs to the **cautious** pilot, who never tucks: 315 ms at 4,640, against the
   tucked rider's 365. He sees the steep boxes no sooner and charges his jump later.

So every hazard is now read on all three measuring pilots (`tuck`, `stay-low`,
`low-line`) wherever each one meets it on the hazard's own surface, and **the worst
reading is the one that counts.** The table reports it together with the pilot it came
from.

`climb` = 5.118 ticks (max-charge release to one standHeight, from `tuning.json`).

## Boxes: time to decide (worst over pilots)

| Course   |  Box x |    ms | Pilot    |
| -------- | -----: | ----: | -------- |
| official |  1,830 |   781 | low-line |
| official |  3,600 |   448 | stay-low |
| official |  4,120 |   365 | stay-low |
| official |  4,640 |   315 | stay-low |
| official |  6,100 |   981 | stay-low |
| official | 11,600 |   348 | tuck     |
| warm-up  |  1,289 | 2,098 | tuck     |
| warm-up  |  5,200 |   715 | low-line |

**Four boxes fail 680 ms today: 3,600, 4,120, 4,640 and 11,600. The worst is 315 ms.**
The boxes at 1,830 and 6,100 and both warm-up boxes already pass. Under FR-248(a) they
do not move. That supersedes research R4's eases at 1,830 and 6,100 and research R9's
warm-up ease. All three came from the probe rider's flawed line, and none is needed.

## Other hazards: lead time, entering view to arrival (worst over pilots)

| Course   | Hazard |      x |    ms | Pilot    |
| -------- | ------ | -----: | ----: | -------- |
| official | rope   |    700 |   900 | tuck     |
| official | ice    |  1,876 |   850 | tuck     |
| official | rock   |  2,076 |   800 | tuck     |
| official | rope   |  3,020 |   800 | tuck     |
| official | rope   |  3,300 |   700 | tuck     |
| official | rope   |  3,820 |   400 | tuck     |
| official | rope   |  4,340 |   333 | tuck     |
| official | rope   |  4,860 |   333 | tuck     |
| official | ice    |  5,546 |   967 | low-line |
| official | ice    |  5,746 |   600 | tuck     |
| official | rock   |  5,996 |   567 | tuck     |
| official | rope   |  6,400 |   967 | stay-low |
| official | rope   |  7,300 |   550 | tuck     |
| official | rope   |  7,600 |   483 | tuck     |
| official | ice    | 11,350 |   550 | tuck     |
| official | rope   | 11,850 |   383 | low-line |
| warm-up  | rope   |    689 | 2,217 | tuck     |
| warm-up  | rope   |  3,900 |   817 | tuck     |
| warm-up  | ice    |  4,926 |   767 | tuck     |
| warm-up  | rock   |  5,126 |   833 | tuck     |

The official rock at 11,600 is met by no measuring pilot. The tuck pilot falls through
the ice at 11,350 and finishes under it, so it has no reading.

## Kicker lip speed, tuck pilot, grounded on the piste

| Course   | Kicker x | Speed |
| -------- | -------: | ----: |
| official |    1,400 | 4.371 |
| official |    5,200 | 5.730 |
| official |    7,852 | 5.045 |
| official |    9,188 | 5.169 |
| official |   11,000 | 5.188 |
| warm-up  |    1,889 | 1.633 |
| warm-up  |    2,489 | 1.633 |
| warm-up  |    4,600 | 4.785 |
| warm-up  |    5,586 | 4.379 |

These match research R4 and R9 exactly.

## Shelves ridden

- **Official**: tuck 3, stay-low 0, low-line 1 (the Cornice).
- **Warm-up**: tuck 1, stay-low 0, low-line 0.

## Sprites (T002)

`git-lfs` installed from apt and `git lfs pull` succeeded. `public/sprites/skier.png`
now carries the PNG signature, and `tests/unit/sprite-palette.test.ts` passes 10/10.
