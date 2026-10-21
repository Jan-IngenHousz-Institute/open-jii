import type { KeyboardEvent } from "react";
import { useRef } from "react";

const MOVES = new Map<string, readonly [number, number]>([
  ["ArrowUp", [-1, 0]],
  ["ArrowDown", [1, 0]],
  ["ArrowLeft", [0, -1]],
  ["ArrowRight", [0, 1]],
]);

function positionKey(row: number, column: number): string {
  return `${row}:${column}`;
}

/** Arrow keys move focus between a grid's plot buttons, stepping over gaps. */
export function useGridFocus(rows: number, columns: number) {
  const cells = useRef(new Map<string, HTMLButtonElement>());

  const register = (row: number, column: number) => (element: HTMLButtonElement | null) => {
    if (element === null) {
      cells.current.delete(positionKey(row, column));
    } else {
      cells.current.set(positionKey(row, column), element);
    }
  };

  /** Moves focus for an arrow key and reports whether the key was one. */
  const move = (row: number, column: number, event: KeyboardEvent<HTMLButtonElement>): boolean => {
    const step = MOVES.get(event.key);
    if (step === undefined) {
      return false;
    }

    event.preventDefault();
    const [rowStep, columnStep] = step;
    let nextRow = row + rowStep;
    let nextColumn = column + columnStep;

    while (nextRow >= 1 && nextRow <= rows && nextColumn >= 1 && nextColumn <= columns) {
      const target = cells.current.get(positionKey(nextRow, nextColumn));
      if (target !== undefined) {
        target.focus();
        return true;
      }
      nextRow += rowStep;
      nextColumn += columnStep;
    }

    return true;
  };

  return { register, move };
}
