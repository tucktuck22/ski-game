// @ts-check
import tseslint from 'typescript-eslint';

/**
 * The rule that matters here is the `src/sim/**` override.
 *
 * research.md R2 and constitution Technical Standards: the simulation may use
 * only IEEE-754's correctly-rounded operators (+ - * /), which are identical on
 * every conforming engine. Math.sin/cos/pow/exp/log/atan2 are explicitly
 * implementation-approximated and DO differ between V8, SpiderMonkey and
 * JavaScriptCore, so a score computed with them is not reproducible.
 *
 * Math.sqrt is correctly rounded on every mainstream engine, but ECMAScript's
 * guarantee for it is weaker than for the four operators, so it is banned too.
 * Use squared-magnitude comparisons, or sqrtDet() in src/sim/math.ts.
 */
export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**', '**/*.min.js', 'src/sim/trig.ts'] },
  ...tseslint.configs.recommended,
  {
    rules: {
      // A leading underscore marks a parameter kept for signature clarity even
      // though this implementation does not need it.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['src/sim/**/*.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'Date', message: 'Simulation code must not read wall-clock time. See research.md R2.' },
        { name: 'performance', message: 'Simulation code must not read wall-clock time. See research.md R2.' },
      ],
      // Precisely the functions ECMAScript declares implementation-approximated.
      // Math.abs/ceil/floor/round/trunc/sign/min/max/imul/fround and the numeric
      // constants ARE exactly specified, so they are deterministic and allowed.
      // Math.sqrt is on the banned list: every mainstream engine rounds it
      // correctly, but the spec's guarantee is weaker than for + - * /, so use
      // sqrtDet() from src/sim/math.ts instead.
      'no-restricted-properties': [
        'error',
        ...[
          'acos', 'acosh', 'asin', 'asinh', 'atan', 'atanh', 'atan2', 'cbrt',
          'cos', 'cosh', 'exp', 'expm1', 'hypot', 'log', 'log1p', 'log2',
          'log10', 'pow', 'random', 'sin', 'sinh', 'sqrt', 'tan', 'tanh',
        ].map((property) => ({
          object: 'Math',
          property,
          message:
            `Math.${property} is implementation-approximated and differs between V8, ` +
            'SpiderMonkey and JavaScriptCore. Use src/sim/trig.ts or src/sim/math.ts. See research.md R2.',
        })),
        { object: 'Date', property: 'now', message: 'Wall-clock reads break determinism. See research.md R2.' },
        { object: 'performance', property: 'now', message: 'Wall-clock reads break determinism. See research.md R2.' },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Date']",
          message: 'Simulation code must not construct dates. See research.md R2.',
        },
      ],
    },
  },
);
