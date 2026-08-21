/**
 * Guard for the token-only theme contract.
 *
 * Every colour and font in apps/web lives in one place — the `:root`/`.dark`
 * blocks of `apps/web/app/globals.css`, surfaced as utilities through
 * `@theme inline`. A class string that names a colour directly (an arbitrary
 * `#`/`oklch()` value, a raw palette literal, or one of the brand families that
 * used to be declared in `tailwind.config.ts`) escapes that contract: swapping
 * the theme no longer changes it.
 *
 * The patterns are matched against string literals and template chunks rather
 * than parsed class lists, so they are deliberately permissive about what
 * precedes the utility (whitespace, a `!`, or a variant chain's `:`).
 *
 * `\x2f` is a literal `/` — spelled as an escape so the sources can be embedded
 * in esquery selectors, whose regex syntax is `/`-delimited.
 */

/** Variant chain / `!` / string boundary in front of the utility. */
const BEFORE = "(?:^|[\\s\"'`:!])";

/** Utility prefixes that take a colour. */
const UTILITY =
  "(?:bg|text|border(?:-[trblsexy]{1,2})?|(?:inset-)?ring(?:-offset)?|outline|divide(?:-[xy])?|from|via|to|fill|stroke|shadow|accent|caret|placeholder|decoration)-";

/** Optional `/50` opacity modifier, and no further word character. */
const AFTER = "(?:\\x2f\\d{1,3})?(?![\\w-])";

/**
 * Every Tailwind hue, not just the greys.
 *
 * The rule shipped covering `white|black|gray|slate|zinc|neutral|stone` only,
 * on the assumption that off-contract colour would be neutral. It wasn't: the
 * sweep found ~40 `amber-*`/`blue-*`/`emerald-*`/`red-*` pairs carrying status
 * meaning, all of which the rule waved through. A hue is a hue.
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
 * Flat-config fragment. Spread into a package's eslint.config.js after the base
 * config.
 *
 * An error, not a warning: the sweep is finished and the inventory is at its
 * floor, so any new occurrence is a regression rather than a leftover. The four
 * surviving cases are the scrims described above, each carrying an inline
 * disable with that justification.
 *
 * @type {Awaited<import('typescript-eslint').Config>}
 */
export const themeTokenGuard = [
  {
    files: ["**/*.tsx"],
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
