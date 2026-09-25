import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/**
 * The course map (tools/course-map, `npm run map`) draws the reaction budgets as
 * lines to judge hazards against. It keeps its own copies of the numbers, because
 * the budget test is a test file and not a module; this keeps the copies honest.
 */
const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p: string): string => readFileSync(join(root, p), 'utf8');
const constant = (src: string, name: string): number => {
  const m = new RegExp(`const ${name} = (\\d+);`).exec(src);
  if (!m) throw new Error(`${name} not found`);
  return Number(m[1]);
};

describe('course map', () => {
  const map = read('tools/course-map/build.ts');
  const budget = read('tests/sim/reaction-budget.test.ts');
  for (const name of ['BUDGET_MS', 'ROPE_AFTER_BOX_MS']) {
    it(`draws ${name} at the value the budget test holds`, () => {
      expect(constant(map, name)).toBe(constant(budget, name));
    });
  }

  it('keeps the placeholder the build fills', () => {
    expect(read('tools/course-map/map.html')).toMatch(/\/\*__MAP_DATA__\*\/\s*null/);
  });
});
