/**
 * The warm-up course with its coached opening cut off, for free play.
 *
 * FR-197: the coached section is a property of practice and MUST NOT appear in
 * free play. Gating the badges on run kind (src/main.ts) was only half of that:
 * free play on the warm-up still rode the coached TERRAIN — the gentle opening,
 * the rope, the deadfall, the two lesson kickers — with the badges switched off.
 * A player who has reached free play has already been taught; making him ride
 * the lesson again with the captions removed is the worst of both.
 *
 * This is a pure function of course data, not a mode and not a record (FR-186a
 * stays intact: nothing here knows or remembers who has been coached). The
 * warm-up file is unchanged; free play is served a derived view of it.
 *
 * COACHED_SPAN IS A COPY of COACH_SPAN in tools/gen-courses.ts, which is the
 * authority. tests/unit/without-coached.test.ts asserts it against the
 * generated warmup.json, the same way the cue table is kept honest.
 */
import type { Course } from '../sim/types.js';

/** World x at which the coached section ends and the warm-up proper begins. */
export const COACHED_SPAN = 3200;

/**
 * Re-bases a course so it starts at `from`: everything before is dropped, and
 * everything after is shifted left (and the terrain down) so the run still
 * starts at x = 0, y = 0 as the simulation expects.
 */
export function withoutCoached(course: Course, from: number = COACHED_SPAN): Course {
  const start = course.terrain.find((p) => p.x === from);
  if (!start) {
    throw new Error(
      `course "${course.id}" has no terrain point at x=${from}; cannot cut the coached section cleanly`,
    );
  }
  const dy = start.y;
  const after = <T extends { x: number }>(xs: T[]): T[] =>
    xs.filter((o) => o.x >= from).map((o) => ({ ...o, x: o.x - from }));

  return {
    ...course,
    length: course.length - from,
    terrain: course.terrain.filter((p) => p.x >= from).map((p) => ({ x: p.x - from, y: p.y - dy })),
    obstacles: after(course.obstacles),
    pickups: after(course.pickups),
    kickers: after(course.kickers),
    rocks: after(course.rocks),
    ledges: course.ledges
      .filter((l) => l.x0 >= from)
      .map((l) => ({ ...l, x0: l.x0 - from, x1: l.x1 - from })),
    ice: course.ice
      .filter((i) => i.x0 >= from)
      .map((i) => ({ ...i, x0: i.x0 - from, x1: i.x1 - from })),
  };
}
