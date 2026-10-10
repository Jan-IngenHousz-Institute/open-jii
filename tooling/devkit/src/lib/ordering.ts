// Linear has been seen rewriting positions that sit close together, so new positions are spread
// wide, and a list already in the right relative order keeps whatever numbers Linear gave it.
export const SORT_STEP = 1000;

export function sortOrderAt(position: number): number {
  return position * SORT_STEP;
}

/**
 * The position each wanted item should have, given its current one or null when it is new. When
 * everything exists and is already in order the current numbers stand; otherwise all are respaced.
 */
export function plannedPositions(current: readonly (number | null)[]): number[] {
  const existing = current.filter((order): order is number => order !== null);
  const isInOrder =
    existing.length === current.length &&
    existing.every((order, index) => index === 0 || order > (existing[index - 1] ?? order));
  return isInOrder ? existing : current.map((_, index) => sortOrderAt(index + 1));
}
