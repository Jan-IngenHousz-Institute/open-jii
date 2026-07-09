"use client";

import { Kbd } from "@/components/command/kbd";

import { useShortcutHint } from "./use-shortcut-hint";

// Bottom-center, pointer-events-none feedback shown when a shortcut fires.
export function ShortcutHint() {
  const hint = useShortcutHint();

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-12 z-[100] flex justify-center px-4"
    >
      {hint ? (
        <div
          key={hint.id}
          className="animate-shortcut-pop flex items-center gap-3 motion-reduce:animate-none"
        >
          <span className="inline-flex items-center gap-1.5">
            {hint.keys.map((key, i) => (
              <Kbd
                key={`${key}-${i}`}
                className="text-foreground h-8 min-w-8 rounded-lg px-2.5 text-sm"
              >
                {key}
              </Kbd>
            ))}
          </span>
          <span className="text-foreground text-base font-semibold tracking-tight">
            {hint.label}
          </span>
        </div>
      ) : null}
    </div>
  );
}
