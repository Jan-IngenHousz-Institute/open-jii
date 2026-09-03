import { reactHooksDirectives, themeTokenGuard } from "@repo/eslint-config/theme-tokens";

/**
 * The theme guard, and only the theme guard, over `src`.
 *
 * `eslint.config.js` deliberately ignores `src/**`: these are vendored shadcn
 * components that predate any linting here, and the full config reports ~2,600
 * TypeScript problems across them — its own piece of work, not a blocker for
 * keeping colour on the contract. Every one of those problems is a type rule;
 * the theme rule reports none, because the only off-contract colours here are
 * the four modal scrims, each carrying an inline disable.
 *
 * A second config file rather than a `files`-scoped block in the first: flat
 * config's top-level `ignores` is global, so `src` cannot be excluded from one
 * set of rules and included in another within a single config.
 *
 * @type {Awaited<import('typescript-eslint').Config>}
 */
export default [{ ignores: ["dist/**"] }, ...reactHooksDirectives, ...themeTokenGuard];
