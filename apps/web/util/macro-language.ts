import type { StatusTone } from "@/components/shared/status-badge";

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
 * Badge tone for a macro language. Unknown values fall back to the neutral tone,
 * so this accepts the raw `language` string carried on a macro.
 *
 * Mirrors `sensor-family.ts`: the tone carries its own foreground, so consumers
 * hand it to `StatusBadge` rather than passing a colour class to `Badge`.
 * JavaScript previously reached for a bare fill with no light/dark pair; it is
 * given `featured`, the one remaining tone not already spoken for here.
 */
export function getMacroLanguageBadgeTone(language: string): StatusTone {
  switch (language) {
    case "python":
      return "published";
    case "r":
      return "stale";
    case "javascript":
      return "featured";
    default:
      return "archived";
  }
}
