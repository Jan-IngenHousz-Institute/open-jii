/** Spreadsheet-style row letters: 1 is A, 26 is Z, 27 is AA. */
export function rowLetter(row: number): string {
  let remaining = row;
  let letters = "";

  while (remaining > 0) {
    const index = (remaining - 1) % 26;
    letters = String.fromCharCode(65 + index) + letters;
    remaining = Math.floor((remaining - 1) / 26);
  }

  return letters;
}
