"use client";

import { Kbd, KbdSequence } from "@/components/command/kbd";
import { CHEATSHEET_OPEN_EVENT } from "@/components/shortcuts/shortcuts-root";
import * as React from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";

interface Row {
  keys: string[];
  label: string;
}

interface Section {
  title: string;
  rows: Row[];
}

const SECTIONS: Section[] = [
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
      { keys: ["G", "R"], label: "What's new" },
    ],
  },
  {
    title: "Actions",
    rows: [
      { keys: ["C"], label: "Create new (route-aware)" },
      { keys: ["E"], label: "Edit current item" },
      { keys: ["/"], label: "Focus inline search" },
      { keys: ["?"], label: "Open this cheatsheet" },
      { keys: ["Esc"], label: "Close / cancel" },
    ],
  },
  {
    title: "Lists",
    rows: [
      { keys: ["J"], label: "Next item" },
      { keys: ["K"], label: "Previous item" },
      { keys: ["↵"], label: "Open focused item" },
    ],
  },
  {
    title: "Global",
    rows: [
      { keys: ["⌘", "K"], label: "Command palette" },
      { keys: ["⌘", "B"], label: "Toggle sidebar" },
    ],
  },
];

export function CheatsheetDialog() {
  const [open, setOpen] = React.useState(false);

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
              <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {section.title}
              </h3>
              <ul className="space-y-2">
                {section.rows.map((row) => (
                  <li
                    key={row.label}
                    className="flex items-center justify-between gap-4 text-sm"
                  >
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
