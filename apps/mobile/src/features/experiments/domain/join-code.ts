import {
  JOIN_CODE_LENGTH,
  normalizeJoinCode,
  zJoinCodeValue,
} from "@repo/api/domains/experiment/join-codes/experiment-join-codes.schema";

const GROUP_LENGTH = JOIN_CODE_LENGTH / 2;

/** Anything a code can never contain, dropped while the student types. */
const NON_CODE_GLYPH = /[^A-Z0-9]/g;

/**
 * The code sits in the last path segment of a landing URL, after an optional
 * locale segment and before any query or fragment. Matching on the path rather
 * than the origin means a QR printed against any environment still parses.
 */
const JOIN_PATH_SEGMENT = /\/join\/([^/?#]+)/;

/**
 * Turns whatever the student typed, pasted or scanned into a normalized join
 * code, or `null` when it is not one. Normalization and the alphabet both come
 * from the contract, so the app and the server never disagree about what a code
 * is.
 */
export function parseJoinCodeInput(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;

  const fromUrl = JOIN_PATH_SEGMENT.exec(trimmed)?.[1];

  for (const candidate of fromUrl ? [fromUrl, trimmed] : [trimmed]) {
    const parsed = zJoinCodeValue.safeParse(candidate);
    if (parsed.success) return parsed.data;
  }

  return null;
}

/**
 * What the code field shows after each keystroke: the glyphs so far, grouped as
 * `XXXX-XXXX`. A pasted landing URL collapses to the code it carries, so the
 * field never fills with the rest of the address. Glyphs outside the alphabet
 * are kept rather than swallowed, so a typo produces an error the student can
 * see rather than a character that silently never appears.
 */
export function formatJoinCodeInput(raw: string): string {
  const parsed = parseJoinCodeInput(raw);
  const glyphs = (parsed ?? normalizeJoinCode(raw).replace(NON_CODE_GLYPH, "")).slice(
    0,
    JOIN_CODE_LENGTH,
  );

  return glyphs.length > GROUP_LENGTH
    ? `${glyphs.slice(0, GROUP_LENGTH)}-${glyphs.slice(GROUP_LENGTH)}`
    : glyphs;
}
