export function ellipsize(text: string, maxLength: number) {
  if (!text) {
    return text;
  }

  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength - 1) + "…";
}
