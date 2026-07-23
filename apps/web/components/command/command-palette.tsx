"use client";

import { iconMap } from "@/components/navigation/navigation-config";
import {
  CHEATSHEET_OPEN_EVENT,
  COMMAND_PALETTE_OPEN_EVENT,
} from "@/components/shortcuts/shortcuts-root";
import { WHATS_NEW_OPEN_EVENT } from "@/components/whats-new/whats-new-shared";
import { useGlobalSearch } from "@/hooks/useGlobalSearch";
import { HelpCircle, Keyboard, Send, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { env } from "~/env";

import type { SearchResult, SearchResultType } from "@repo/api/domains/search/search.schema";
import { useTranslation } from "@repo/i18n";
import {
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@repo/ui/components/command";
import { DialogTitle } from "@repo/ui/components/dialog";

import { CheatsheetDialog } from "./cheatsheet-dialog";
import { SearchResultItem } from "./search-result-item";

interface PaletteEntry {
  id: string;
  labelKey: string;
  group: "pages" | "actions";
  icon?: React.ComponentType<{ className?: string }>;
  shortcut?: string;
  run: () => void;
}

const RESULT_GROUPS: { type: SearchResultType; headingKey: string }[] = [
  { type: "experiment", headingKey: "commandPalette.results.experiments" },
  { type: "protocol", headingKey: "commandPalette.results.protocols" },
  { type: "macro", headingKey: "commandPalette.results.macros" },
  { type: "workbook", headingKey: "commandPalette.results.workbooks" },
];

export function CommandPalette({ locale }: { locale: string }) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const router = useRouter();
  const { t } = useTranslation("navigation");

  React.useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(COMMAND_PALETTE_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(COMMAND_PALETTE_OPEN_EVENT, onOpen);
  }, []);

  // Reset the query whenever the dialog opens or closes so a stale term doesn't linger.
  const handleOpenChange = React.useCallback((next: boolean) => {
    setOpen(next);
    if (!next) setQuery("");
  }, []);

  const navigate = React.useCallback(
    (path: string) => {
      setOpen(false);
      setQuery("");
      router.push(path);
    },
    [router],
  );

  const { results, isSearching, isError, enabled } = useGlobalSearch(query);

  const entries: PaletteEntry[] = React.useMemo(
    () => [
      {
        id: "page.dashboard",
        labelKey: "commandPalette.entries.home",
        group: "pages",
        icon: iconMap.LayoutDashboard,
        shortcut: "G H",
        run: () => navigate(`/${locale}/platform`),
      },
      {
        id: "page.experiments",
        labelKey: "commandPalette.entries.experiments",
        group: "pages",
        icon: iconMap.Leaf,
        shortcut: "G E",
        run: () => navigate(`/${locale}/platform/experiments`),
      },
      {
        id: "page.workbooks",
        labelKey: "commandPalette.entries.workbooks",
        group: "pages",
        icon: iconMap.BookOpen,
        shortcut: "G W",
        run: () => navigate(`/${locale}/platform/workbooks`),
      },
      {
        id: "page.protocols",
        labelKey: "commandPalette.entries.protocols",
        group: "pages",
        icon: iconMap.FileSliders,
        shortcut: "G P",
        run: () => navigate(`/${locale}/platform/protocols`),
      },
      {
        id: "page.macros",
        labelKey: "commandPalette.entries.macros",
        group: "pages",
        icon: iconMap.Code,
        shortcut: "G M",
        run: () => navigate(`/${locale}/platform/macros`),
      },
      {
        id: "page.transfer",
        labelKey: "commandPalette.entries.transferRequests",
        group: "pages",
        icon: Send,
        shortcut: "G T",
        run: () => navigate(`/${locale}/platform/transfer-request`),
      },
      {
        id: "page.settings",
        labelKey: "commandPalette.entries.settings",
        group: "pages",
        icon: iconMap.Settings,
        shortcut: "G S",
        run: () => navigate(`/${locale}/platform/account`),
      },
      {
        id: "action.create-experiment",
        labelKey: "commandPalette.entries.createExperiment",
        group: "actions",
        icon: iconMap.CirclePlus,
        run: () => navigate(`/${locale}/platform/experiments/new`),
      },
      {
        id: "action.whats-new",
        labelKey: "commandPalette.entries.openWhatsNew",
        group: "actions",
        icon: Sparkles,
        shortcut: "G R",
        run: () => {
          setOpen(false);
          window.dispatchEvent(new Event(WHATS_NEW_OPEN_EVENT));
        },
      },
      {
        id: "action.cheatsheet",
        labelKey: "commandPalette.entries.showKeyboardShortcuts",
        group: "actions",
        icon: Keyboard,
        shortcut: "?",
        run: () => {
          setOpen(false);
          window.dispatchEvent(new Event(CHEATSHEET_OPEN_EVENT));
        },
      },
      {
        id: "action.help",
        labelKey: "commandPalette.entries.openDocumentation",
        group: "actions",
        icon: HelpCircle,
        run: () => {
          setOpen(false);
          window.open(env.NEXT_PUBLIC_DOCS_URL, "_blank", "noopener,noreferrer");
        },
      },
    ],
    [locale, navigate],
  );

  // Filtering is disabled on the Command (server results are pre-ranked), so we filter the static
  // navigation entries ourselves with a simple case-insensitive substring match.
  const normalizedQuery = query.trim().toLowerCase();
  const matchesQuery = (label: string) =>
    normalizedQuery === "" || label.toLowerCase().includes(normalizedQuery);
  const pages = entries.filter((e) => e.group === "pages" && matchesQuery(t(e.labelKey)));
  const actions = entries.filter((e) => e.group === "actions" && matchesQuery(t(e.labelKey)));

  const resultsByType = React.useMemo(() => {
    const groups: Record<SearchResultType, SearchResult[]> = {
      experiment: [],
      protocol: [],
      macro: [],
      workbook: [],
    };
    for (const result of results) groups[result.type].push(result);
    return groups;
  }, [results]);

  const onSelectResult = React.useCallback(
    (result: SearchResult) => {
      switch (result.type) {
        case "experiment":
          return navigate(`/${locale}/platform/experiments/${result.id}`);
        case "protocol":
          return navigate(`/${locale}/platform/protocols/${result.id}`);
        case "macro":
          return navigate(`/${locale}/platform/macros/${result.id}`);
        case "workbook":
          return navigate(`/${locale}/platform/workbooks/${result.id}`);
      }
    },
    [locale, navigate],
  );

  const hasStaticEntries = pages.length > 0 || actions.length > 0;
  const hasResults = results.length > 0;
  // Only surface the "no results" message when the static pages/actions also came up empty —
  // otherwise those matches are a useful answer and a "nothing matched" notice would contradict them.
  const showEmptyState = enabled && !isSearching && !isError && !hasResults && !hasStaticEntries;
  const showSearchResults = enabled && !isSearching && !isError && hasResults;
  const showSearchSection =
    enabled && (isSearching || isError || showSearchResults || showEmptyState);

  return (
    <>
      <CommandDialog
        open={open}
        onOpenChange={handleOpenChange}
        commandProps={{ shouldFilter: false }}
      >
        <DialogTitle className="sr-only">{t("commandPalette.title")}</DialogTitle>
        <CommandInput
          placeholder={t("commandPalette.placeholder")}
          value={query}
          onValueChange={setQuery}
        />
        <CommandList className="min-h-75">
          {pages.length > 0 && (
            <CommandGroup heading={t("commandPalette.groups.pages")}>
              {pages.map((entry) => (
                <CommandItem key={entry.id} value={entry.id} onSelect={() => entry.run()}>
                  {entry.icon && <entry.icon className="mr-2 h-4 w-4" />}
                  {t(entry.labelKey)}
                  {entry.shortcut && (
                    <span className="text-muted-foreground ml-auto text-xs tracking-widest">
                      {entry.shortcut}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {actions.length > 0 && (
            <>
              {pages.length > 0 && <CommandSeparator />}
              <CommandGroup heading={t("commandPalette.groups.actions")}>
                {actions.map((entry) => (
                  <CommandItem key={entry.id} value={entry.id} onSelect={() => entry.run()}>
                    {entry.icon && <entry.icon className="mr-2 h-4 w-4" />}
                    {t(entry.labelKey)}
                    {entry.shortcut && (
                      <span className="text-muted-foreground ml-auto text-xs tracking-widest">
                        {entry.shortcut}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          {showSearchSection && (
            <>
              {hasStaticEntries && <CommandSeparator />}
              {showSearchResults ? (
                RESULT_GROUPS.map(({ type, headingKey }) =>
                  resultsByType[type].length > 0 ? (
                    <CommandGroup key={type} heading={t(headingKey)}>
                      {resultsByType[type].map((result) => (
                        <SearchResultItem
                          key={`${result.type}:${result.id}`}
                          result={result}
                          onSelect={onSelectResult}
                        />
                      ))}
                    </CommandGroup>
                  ) : null,
                )
              ) : (
                // No results to list — center the status message in whatever space is left so it
                // doesn't cling to the static entries above it.
                <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-1 px-6 py-8 text-center text-sm">
                  {isSearching ? (
                    <span>{t("commandPalette.status.searching")}</span>
                  ) : isError ? (
                    <>
                      <span className="text-foreground font-medium">
                        {t("commandPalette.status.errorTitle")}
                      </span>
                      <span>{t("commandPalette.status.errorDescription")}</span>
                    </>
                  ) : (
                    <>
                      <span className="text-foreground font-medium">
                        {t("commandPalette.status.noResultsTitle")}
                      </span>
                      <span>
                        {t("commandPalette.status.noResultsDescription", {
                          query: query.trim(),
                        })}
                      </span>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </CommandList>
      </CommandDialog>
      <CheatsheetDialog />
    </>
  );
}
