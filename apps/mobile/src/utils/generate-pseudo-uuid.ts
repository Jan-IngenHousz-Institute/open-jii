function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}

export function generatePseudoUUID(obj: any): string {
  const base = JSON.stringify(obj);
  const hash = simpleHash(base);
  // Format like UUID: 8-4-4-4-12 (just for structure, not real entropy)
  return `${hash.slice(0, 8)}-${hash.slice(0, 4)}-${hash.slice(0, 4)}-${hash.slice(0, 4)}-${hash.repeat(3).slice(0, 12)}`;
}
