"use client";

import { Kbd } from "@/components/command/kbd";

import { useShortcutHint } from "./use-shortcut-hint";

// Triple drop shadow: a tight contact edge, a mid lift, and a soft deep cast —
// gives the keycaps real elevation with no surface of their own.
const KEYCAP_SHADOW =
  "shadow-[0_1px_0_rgba(0,0,0,0.10),0_3px_6px_rgba(0,0,0,0.16),0_12px_24px_rgba(0,0,0,0.22)]";

// Bottom-center feedback when a global shortcut fires. It has no background of
// its own — the keycaps float in with a layered shadow and a single overshoot,
// reading as a tactile press rather than a toast. Informational only, so it
// never captures pointer events.
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
                className={`text-foreground h-8 min-w-8 rounded-lg px-2.5 text-sm ${KEYCAP_SHADOW}`}
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
