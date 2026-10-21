/**
 * A layout's unit name in the forms copy needs: as typed, lowercase in a sentence, and plural in a
 * count. The plural follows English spelling rules until the contract stores one beside the name.
 */
export class UnitName {
  constructor(readonly name: string) {}

  get lower(): string {
    return this.name.toLowerCase();
  }

  get plural(): string {
    const word = this.lower;
    if (/(s|x|z|ch|sh)$/.test(word)) {
      return `${word}es`;
    }
    if (/[^aeiou]y$/.test(word)) {
      return `${word.slice(0, -1)}ies`;
    }
    return `${word}s`;
  }

  /** Interpolation values for the `_one` and `_other` forms of a counted key. */
  forCount(count: number): { count: number; unit: string; units: string } {
    return { count, unit: this.lower, units: this.plural };
  }
}
