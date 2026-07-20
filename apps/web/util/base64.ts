/**
 * Safely decode base64 content
 * @param content - The base64 encoded string or null
 * @returns The decoded string or empty string if content is null/invalid
 */
export const decodeBase64 = (content: string | null): string => {
  if (!content) return "";
  try {
    const binary = atob(content);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      // Content saved by the old Latin1 `btoa` path (e.g. "25°C").
      return binary;
    }
  } catch {
    return "Error decoding content";
  }
};

/**
 * Safely encode content to base64
 * @param content - The string content to encode
 * @returns The base64 encoded string
 */
export const encodeBase64 = (content: string): string => {
  try {
    // Encode as UTF-8 first: `btoa` alone throws on any non-Latin1 char
    // (smart quotes, µ, →, emoji, CJK …), which used to silently drop the code.
    const bytes = new TextEncoder().encode(content);
    let binary = "";
    const CHUNK = 0x8000; // chunk the spread so long macros can't overflow the call stack
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
    }
    return btoa(binary);
  } catch {
    return "";
  }
};
