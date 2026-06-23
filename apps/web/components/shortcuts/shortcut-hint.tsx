"use client";

import { Kbd } from "@/components/command/kbd";

import { useShortcutHint } from "./use-shortcut-hint";

// Bottom-center, pointer-events-none feedback shown when a shortcut fires.
// TODO: move the inline keyframes to an animate-* theme utility after the Tailwind upgrade.
export function ShortcutHint() {
  const hint = useShortcutHint();

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-12 z-[100] flex justify-center px-4"
    >
      <style>{`
        @keyframes shortcut-pop {
          0%   { opacity: 0; transform: translateY(16px) scale(0.85); }
          55%  { opacity: 1; transform: translateY(-5px) scale(1.07); }
          78%  { transform: translateY(1px) scale(0.99); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .shortcut-pop { animation: none !important; }
        }
      `}</style>
      {hint ? (
        <div
          key={hint.id}
          className="shortcut-pop flex items-center gap-3"
          style={{ animation: "shortcut-pop 420ms cubic-bezier(0.34, 1.56, 0.64, 1) both" }}
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
