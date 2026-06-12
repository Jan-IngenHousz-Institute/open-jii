"use client";

import { iconMap } from "@/components/navigation/navigation-config";
import {
  CHEATSHEET_OPEN_EVENT,
  COMMAND_PALETTE_OPEN_EVENT,
} from "@/components/shortcuts/shortcuts-root";
import { HelpCircle, Keyboard, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@repo/ui/components/command";
import { DialogTitle } from "@repo/ui/components/dialog";

import { CheatsheetDialog } from "./cheatsheet-dialog";

interface PaletteEntry {
  id: string;
  label: string;
  group: "Pages" | "Actions";
  icon?: React.ComponentType<{ className?: string }>;
  shortcut?: string;
  run: () => void;
}

export function CommandPalette({ locale }: { locale: string }) {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(COMMAND_PALETTE_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(COMMAND_PALETTE_OPEN_EVENT, onOpen);
  }, []);

  const navigate = React.useCallback(
    (path: string) => {
      setOpen(false);
      router.push(path);
    },
    [router],
  );

  const entries: PaletteEntry[] = React.useMemo(
    () => [
      {
        id: "page.dashboard",
        label: "Dashboard",
        group: "Pages",
        icon: iconMap.LayoutDashboard,
        shortcut: "G H",
        run: () => navigate(`/${locale}/platform`),
      },
      {
        id: "page.experiments",
        label: "Experiments",
        group: "Pages",
        icon: iconMap.Leaf,
        shortcut: "G E",
        run: () => navigate(`/${locale}/platform/experiments`),
      },
      {
        id: "page.workbooks",
        label: "Workbooks",
        group: "Pages",
        icon: iconMap.BookOpen,
        shortcut: "G W",
        run: () => navigate(`/${locale}/platform/workbooks`),
      },
      {
        id: "page.protocols",
        label: "Protocols",
        group: "Pages",
        icon: iconMap.FileSliders,
        shortcut: "G P",
        run: () => navigate(`/${locale}/platform/protocols`),
      },
      {
        id: "page.macros",
        label: "Macros",
        group: "Pages",
        icon: iconMap.Code,
        shortcut: "G M",
        run: () => navigate(`/${locale}/platform/macros`),
      },
      {
        id: "page.transfer",
        label: "Transfer requests",
        group: "Pages",
        icon: Send,
        shortcut: "G T",
        run: () => navigate(`/${locale}/platform/transfer-request`),
      },
      {
        id: "page.settings",
        label: "Settings",
        group: "Pages",
        icon: iconMap.Settings,
        shortcut: "G S",
        run: () => navigate(`/${locale}/platform/account/settings`),
      },
      {
        id: "action.create-experiment",
        label: "Create experiment",
        group: "Actions",
        icon: iconMap.CirclePlus,
        run: () => navigate(`/${locale}/platform/experiments/new`),
      },
      {
        id: "action.cheatsheet",
        label: "Show keyboard shortcuts",
        group: "Actions",
        icon: Keyboard,
        shortcut: "?",
        run: () => {
          setOpen(false);
          window.dispatchEvent(new Event(CHEATSHEET_OPEN_EVENT));
        },
      },
      {
        id: "action.help",
        label: "Open documentation",
        group: "Actions",
        icon: HelpCircle,
        run: () => {
          setOpen(false);
          window.open("https://docs.openjii.org", "_blank", "noopener,noreferrer");
        },
      },
    ],
    [locale, navigate],
  );

  const pages = entries.filter((e) => e.group === "Pages");
  const actions = entries.filter((e) => e.group === "Actions");

  return (
    <>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <CommandInput placeholder="Search pages and actions…" />
        <CommandList>
          <CommandEmpty>No results.</CommandEmpty>
          <CommandGroup heading="Pages">
            {pages.map((entry) => (
              <CommandItem key={entry.id} value={entry.label} onSelect={() => entry.run()}>
                {entry.icon && <entry.icon className="mr-2 h-4 w-4" />}
                {entry.label}
                {entry.shortcut && (
                  <span className="text-muted-foreground ml-auto text-xs tracking-widest">
                    {entry.shortcut}
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Actions">
            {actions.map((entry) => (
              <CommandItem key={entry.id} value={entry.label} onSelect={() => entry.run()}>
                {entry.icon && <entry.icon className="mr-2 h-4 w-4" />}
                {entry.label}
                {entry.shortcut && (
                  <span className="text-muted-foreground ml-auto text-xs tracking-widest">
                    {entry.shortcut}
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
      <CheatsheetDialog />
    </>
  );
}
