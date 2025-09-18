/**
 * Safely decode base64 content
 * @param content - The base64 encoded string or null
 * @returns The decoded string or empty string if content is null/invalid
 */
export const decodeBase64 = (content: string | null): string => {
  if (!content) return "";
  try {
    return atob(content);
  } catch (e) {
    console.error("Failed to decode base64 content:", e);
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
    return btoa(content);
  } catch (e) {
    console.error("Failed to encode content to base64:", e);
    return "";
  }
};
