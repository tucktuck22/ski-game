import { readFileSync } from 'node:fs';
import { parseCourse, parseScoring, parseTuning } from '../../src/data/load.js';

const read = (p: string): unknown =>
  JSON.parse(readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8'));

export const tuning = parseTuning(read('data/tuning.json'));
export const scoring = parseScoring(read('data/scoring.json'));
export const warmup = parseCourse(read('data/courses/warmup.json'));
export const official = parseCourse(read('data/courses/official.json'));
