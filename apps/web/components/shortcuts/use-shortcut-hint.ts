"use client";

import * as React from "react";

const HINT_DURATION_MS = 1200;

export interface ShortcutHint {
  id: number;
  keys: string[];
  label: string;
}

// Single-slot store, kept separate from the toast store so the two never evict each other.
let current: ShortcutHint | null = null;
let counter = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<(hint: ShortcutHint | null) => void>();

function emit() {
  for (const listener of listeners) listener(current);
}

export function showShortcutHint(hint: { keys: string[]; label: string }) {
  counter += 1;
  current = { id: counter, keys: hint.keys, label: hint.label };
  emit();
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    current = null;
    timer = null;
    emit();
  }, HINT_DURATION_MS);
}

export function useShortcutHint(): ShortcutHint | null {
  const [hint, setHint] = React.useState<ShortcutHint | null>(current);
  React.useEffect(() => {
    listeners.add(setHint);
    setHint(current);
    return () => {
      listeners.delete(setHint);
    };
  }, []);
  return hint;
}
