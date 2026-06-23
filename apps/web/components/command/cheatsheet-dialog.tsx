"use client";

import { Kbd, KbdSequence } from "@/components/command/kbd";
import { CHEATSHEET_OPEN_EVENT } from "@/components/shortcuts/shortcuts-root";
import { useShortcutHint } from "@/components/shortcuts/use-shortcut-hint";
import { modifierLabel } from "@/lib/platform";
import * as React from "react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@repo/ui/components/dialog";

interface Row {
  keys: string[];
  label: string;
}

interface Section {
  title: string;
  rows: Row[];
}

function buildSections(mod: string): Section[] {
  return [
    {
      title: "Go to",
      rows: [
        { keys: ["G", "H"], label: "Home" },
        { keys: ["G", "E"], label: "Experiments" },
        { keys: ["G", "W"], label: "Workbooks" },
        { keys: ["G", "P"], label: "Protocols" },
        { keys: ["G", "M"], label: "Macros" },
        { keys: ["G", "T"], label: "Transfer requests" },
        { keys: ["G", "S"], label: "Settings" },
        { keys: ["G", "A"], label: "Account" },
        { keys: ["G", "N"], label: "Notifications" },
      ],
    },
    {
      title: "Actions",
      rows: [
        { keys: ["C"], label: "Create new" },
        { keys: ["/"], label: "Focus search" },
      ],
    },
    {
      title: "Global",
      rows: [
        { keys: [mod, "K"], label: "Command palette" },
        { keys: [mod, "B"], label: "Toggle sidebar" },
        { keys: ["?"], label: "Open this cheatsheet" },
        { keys: ["Esc"], label: "Close / cancel" },
      ],
    },
  ];
}

export function CheatsheetDialog() {
  const [open, setOpen] = React.useState(false);
  const [mod, setMod] = React.useState("⌘");
  React.useEffect(() => setMod(modifierLabel()), []);
  const SECTIONS = React.useMemo(() => buildSections(mod), [mod]);

  // `?` toggles the sheet; the command palette only fires this while it's closed.
  React.useEffect(() => {
    const onToggle = () => setOpen((prev) => !prev);
    window.addEventListener(CHEATSHEET_OPEN_EVENT, onToggle);
    return () => window.removeEventListener(CHEATSHEET_OPEN_EVENT, onToggle);
  }, []);

  // Non-blocking reference (modal={false} + autofocus suppressed) so shortcuts keep
  // firing; dismiss on the first hint raised after it opened.
  const hint = useShortcutHint();
  const latestHint = React.useRef(hint);
  latestHint.current = hint;
  const baselineHintId = React.useRef<number | null>(null);
  React.useEffect(() => {
    if (open) baselineHintId.current = latestHint.current?.id ?? null;
  }, [open]);
  React.useEffect(() => {
    if (open && hint && hint.id !== baselineHintId.current) setOpen(false);
  }, [open, hint]);

  return (
    <Dialog open={open} onOpenChange={setOpen} modal={false}>
      <DialogContent
        className="max-h-[70vh] max-w-3xl overflow-y-auto"
        overlayClassName="bg-transparent pointer-events-none"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
          {SECTIONS.map((section) => (
            <section key={section.title}>
              <h3 className="text-muted-foreground mb-3 text-xs font-medium uppercase tracking-wider">
                {section.title}
              </h3>
              <ul className="space-y-2">
                {section.rows.map((row) => (
                  <li key={row.label} className="flex items-center justify-between gap-4 text-sm">
                    <span>{row.label}</span>
                    {row.keys.length === 1 ? (
                      <Kbd>{row.keys[0]}</Kbd>
                    ) : (
                      <KbdSequence keys={row.keys} />
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
