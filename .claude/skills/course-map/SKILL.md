---
name: 'course-map'
description: 'Render and publish the ski course map: both courses drawn to scale with the measuring pilots, reaction times, and the camera frame. Use when asked to show, render, map or visualise the course, and after any change to course geometry, tuning, the camera or the pilots, so the maintainer can review the change before playing it.'
argument-hint: 'Optional: what changed, or what to look at (a section, an x position)'
user-invocable: true
disable-model-invocation: false
---

## User Input

```text
$ARGUMENTS
```

## What the map is

`npm run map` builds `dist/course-map.html` and `dist/course-map.summary.txt` from
`data/` and the real simulation. `tools/course-map/build.ts` rides the three measuring
pilots from `tests/sim/pilots.ts` through both courses. It uses the game's camera
(`cameraFor` plus `LookFollower`) and the reaction measure from `tests/sim/reaction.ts`.
`tools/course-map/map.html` only draws what it is given. The map is a review surface,
not a test: `tests/sim/reaction-budget.test.ts` is still what holds the budgets.

The maintainer's published map lives at **https://claude.ai/artifact/WFZq386oHRW5Wmm9R5ToTZ**.
Update that artifact. Do not create a new one unless they ask for one.

## When to run it

- The maintainer asks to see, render or map the course.
- After any change to `tools/gen-courses.ts`, `data/courses/*.json`, `data/tuning.json`,
  `data/camera.json`, `src/render/rampGeometry.ts`, `cameraFor` in `src/render/draw.ts`,
  or `tests/sim/pilots.ts`, before handing over a play-pass build. The map comes first
  so that the play pass is spent on feel, not on things the numbers already show.

## Steps

1. **Baseline, if something is about to change.** Before editing, run `npm run map` and
   copy `dist/course-map.summary.txt` to the scratchpad as `before.txt`. Skip this when
   only rendering the current state.
2. **Regenerate the courses** if course geometry changed:
   `node --experimental-strip-types tools/gen-courses.ts`.
3. **Build the map:** `npm run map`. It prints the summary. A throw about the
   `/*__MAP_DATA__*/` placeholder means `map.html` lost it; restore it.
4. **Diff:** `diff before.txt dist/course-map.summary.txt`. This is what goes in the
   reply: riders who stopped finishing, boxes that went `BELOW` or `tight`, box → rope
   pairs under 300 ms, and big moves in lead time. Say which were already that way
   before.
5. **Look once, only if the page itself changed** (`map.html` or the shape of the data).
   Screenshot it with Playwright. Launch with
   `executablePath: '/opt/pw-browsers/chromium'`, because the bundled headless shell is
   not installed here. Run the script from inside the repo so `playwright` resolves.
   Load the file with `page.setContent`, wrapped in a minimal
   `<!doctype html><html><head><meta charset="utf-8"></head><body>…`. The Google Fonts
   request failing with a certificate error is expected in this sandbox. Do not screenshot
   when only the data changed.
6. **Publish** with the Artifact tool: `file_path: dist/course-map.html`,
   `url: https://claude.ai/artifact/WFZq386oHRW5Wmm9R5ToTZ`, and `label` set to
   `Rules <version> at <short sha>`. Build from a committed tree when possible. The page
   shows the commit, and a `+local` suffix means uncommitted changes to `data/`, `src/`
   or `tools/`.
7. **Reply** with the link, the diff from step 4 in plain words, and anything the
   maintainer should look at, named by section and x position.

## Say what it cannot show

- The pilots are bots with perfect reactions. The map shows what is possible, not
  what a person will do. It does not replace the play pass (constitution Principle
  VIII); it narrows down what the play pass needs to look at.
- The profile is levelled against the average fall line, so heights are true but
  gentler ground appears to rise. The camera frame panel shows the true slope.
- Sprites, trees and effects are not drawn. Ropes are drawn as their collision slabs.

## Extending it

Add a new hazard kind, course section or measured number in `build.ts` first, then
draw it in `map.html`. Section names are copied from the `// ---- ` headings in
`tools/gen-courses.ts`; keep `SECTIONS` in step when those change. Keep the
reaction-budget constants (`BUDGET_MS`, `ROPE_AFTER_BOX_MS`) equal to the ones in
`tests/sim/reaction-budget.test.ts`.
