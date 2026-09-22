import reactHooks from "eslint-plugin-react-hooks";
import * as tseslint from "typescript-eslint";

/**
 * Guard for the token-only theme contract: colour lives in the `:root`/`.dark`
 * blocks of `apps/web/app/globals.css`, and a class string that names one
 * directly escapes it.
 *
 * Matched against string literals and template chunks rather than parsed class
 * lists, so the patterns are permissive about what precedes the utility.
 * `\x2f` is a literal `/`, escaped so the sources can sit inside an esquery
 * selector's `/`-delimited regex.
 */

/** Variant chain / `!` / string boundary in front of the utility. */
const BEFORE = "(?:^|[\\s\"'`:!])";

/** Utility prefixes that take a colour. */
const UTILITY =
  "(?:bg|text|border(?:-[trblsexy]{1,2})?|(?:inset-)?ring(?:-offset)?|outline|divide(?:-[xy])?|from|via|to|fill|stroke|shadow|accent|caret|placeholder|decoration)-";

/** Optional `/50` opacity modifier, and no further word character. */
const AFTER = "(?:\\x2f\\d{1,3})?(?![\\w-])";

/**
 * Every hue, not just the greys. Covering only the neutrals let ~40 status-
 * carrying `amber-*`/`emerald-*`/`red-*` pairs through.
 */
const PALETTE_HUES =
  "(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)";

/**
 * @typedef {object} ThemeClassPattern
 * @property {string} id
 * @property {string} source regex source, usable with `new RegExp(source, "g")`
 * @property {string} message
 */

/** @type {ThemeClassPattern[]} */
export const themeClassPatterns = [
  {
    id: "arbitrary-color",
    source: `${BEFORE}${UTILITY}\\[(?:#[0-9a-fA-F]{3,8}|(?:ok)?lch\\(|(?:ok)?lab\\(|hsla?\\(|rgba?\\(|color-mix\\()`,
    message:
      "Arbitrary colour value in a class string. Use a theme token (bg-card, text-muted-foreground, …) so the theme stays swappable from globals.css.",
  },
  {
    id: "palette-literal",
    source: `${BEFORE}${UTILITY}(?:white|black|${PALETTE_HUES}-(?:50|\\d{2,3}))${AFTER}`,
    message:
      "Raw palette literal in a class string. Use a theme token (bg-background, bg-card, text-muted-foreground, border-border, …) instead.",
  },
  {
    id: "dissolved-family",
    source: `${BEFORE}${UTILITY}(?:jii-[a-z-]+|surface(?:-(?:light|dark|foreground))?|quaternary(?:-(?:light|dark))?|highlight(?:-(?:light|dark|foreground))?|tertiary(?:-foreground)?|badge(?:-[a-z]+)?)${AFTER}`,
    message:
      "This colour family no longer exists — it was declared in tailwind.config.ts and has been dissolved into globals.css. Map it onto a contract token, or onto a --status-* token for status badges.",
  },
];

/** Regex sources are `/`-free by construction, so no escaping is needed here. */
const selectorRegex = (source) => `/${source}/`;

/**
 * For a package that lints with the theme guard alone: ESLint errors on an
 * inline disable naming a rule it cannot resolve, and merely registering the
 * plugin trades that for an unused-directive warning — so the rule runs, at
 * `warn`. Exported here so the consumer needs no new devDependency.
 *
 * @type {Awaited<import('typescript-eslint').Config>}
 */
export const reactHooksDirectives = [
  {
    files: ["**/*.tsx"],
    plugins: { "react-hooks": reactHooks },
    rules: { "react-hooks/exhaustive-deps": "warn" },
  },
];

/**
 * Spread into a package's eslint.config.js after the base config. An error, not
 * a warning: the sweep is done, so a new occurrence is a regression. The
 * survivors are fixed scrims and their paired foregrounds, each carrying an
 * inline disable that says why.
 *
 * @type {Awaited<import('typescript-eslint').Config>}
 */
export const themeTokenGuard = [
  {
    files: ["**/*.tsx"],
    // Its own parser, so the guard can be dropped into a package alone —
    // `packages/ui` does that, where the full config is not yet viable.
    languageOptions: { parser: tseslint.parser },
    rules: {
      "no-restricted-syntax": [
        "error",
        ...themeClassPatterns.flatMap(({ source, message }) => [
          { selector: `Literal[value=${selectorRegex(source)}]`, message },
          { selector: `TemplateElement[value.cooked=${selectorRegex(source)}]`, message },
        ]),
      ],
    },
  },
];
