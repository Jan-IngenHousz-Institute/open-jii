import type * as React from "react";

/**
 * An auto-focus handler that moves focus to a cmdk root instead: nothing inside is tabbable, and
 * cmdk reads the arrow keys on its root.
 */
export function focusCommandRoot(ref: React.RefObject<HTMLDivElement | null>) {
  return (event: Event) => {
    event.preventDefault();
    ref.current?.focus({ preventScroll: true });
  };
}
