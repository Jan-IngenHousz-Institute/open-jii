"use client";

import { Kbd, KbdSequence } from "@/components/command/kbd";
import { CHEATSHEET_OPEN_EVENT } from "@/components/shortcuts/shortcuts-root";
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

  React.useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(CHEATSHEET_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(CHEATSHEET_OPEN_EVENT, onOpen);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[70vh] max-w-3xl overflow-y-auto">
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
