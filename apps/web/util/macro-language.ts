/**
 * Display spelling for a macro language. These are product names, not translated
 * words: `r` is "R", not "R" by capitalization, and "JavaScript" carries its own
 * casing. Accepts the raw stored string, so an unrecognised value renders as itself
 * rather than as a blank badge.
 */
export function getMacroLanguageLabel(language: string): string {
  switch (language) {
    case "python":
      return "Python";
    case "r":
      return "R";
    case "javascript":
      return "JavaScript";
    default:
      return language;
  }
}

/**
 * Badge color class for a macro language. Unknown values fall back to the neutral
 * badge, so this accepts the raw `language` string carried on a macro.
 *
 * Mirrors `sensor-family.ts`: the pale `badge-*` fills are designed to sit under the
 * Badge component's default `text-black`, so consumers pass this as the only class
 * and leave the variant alone.
 */
export function getMacroLanguageBadgeColor(language: string): string {
  switch (language) {
    case "python":
      return "bg-badge-published";
    case "r":
      return "bg-badge-stale";
    case "javascript":
      return "bg-badge";
    default:
      return "bg-badge-archived";
  }
}
