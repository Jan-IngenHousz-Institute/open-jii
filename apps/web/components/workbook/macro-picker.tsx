"use client";

import { useMacroCreate } from "@/hooks/macro/useMacroCreate/useMacroCreate";
import { useMacros } from "@/hooks/macro/useMacros/useMacros";
import { encodeBase64 } from "@/util/base64";
import { Code, Loader2, Plus, Search } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import type { MacroCell, MacroLanguage } from "@repo/api";
import { useSession } from "@repo/auth/client";
import {
  Badge,
  Button,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components";

interface MacroPickerProps {
  onSelect: (cell: MacroCell) => void;
  children: ReactNode;
}

const languageLabels: Record<MacroLanguage, string> = {
  python: "Python",
  r: "R",
  javascript: "JavaScript",
};

function getDefaultCode(language: MacroLanguage, username: string): string {
  const date = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  switch (language) {
    case "python":
      return `# Macro for data evaluation on openjii.org\n# by: ${username}\n# created: ${date}\n\n# Define Output Dictionary (required)\noutput = {}\n\n# Insert your macro code here\n\n# Return Output Dictionary (required)\nreturn output\n`;
    case "r":
      return `# Macro for data evaluation on openjii.org\n# by: ${username}\n# created: ${date}\n\n# Define Output List (required)\noutput <- list()\n\n# Insert your macro code here\n\n# Return Output List (required)\noutput\n`;
    case "javascript":
      return `/**\n * Macro for data evaluation on openjii.org\n * by: ${username}\n * created: ${date}\n */\n\n// Define Output Object (required)\nvar output = {};\n\n// Insert your macro code here\n\n// Return Output Object (required)\nreturn output;\n`;
    default:
      return "# Insert your macro code here\n";
  }
}

export function MacroPicker({ onSelect, children }: MacroPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [language, setLanguage] = useState<MacroLanguage | undefined>(undefined);
  const { data: session } = useSession();
  const { data: macros } = useMacros({
    initialFilter: "all",
    initialSearch: search,
    initialLanguage: language,
  });

  // Create-new state
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newLanguage, setNewLanguage] = useState<MacroLanguage>("python");
  const [isCreating, setIsCreating] = useState(false);
  const createMacro = useMacroCreate();

  const handleSelect = (macro: { id: string; name: string; language: MacroLanguage }) => {
    const cell: MacroCell = {
      id: crypto.randomUUID(),
      type: "macro",
      isCollapsed: false,
      payload: {
        macroId: macro.id,
        language: macro.language,
        name: macro.name,
      },
    };
    onSelect(cell);
    resetAndClose();
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setIsCreating(true);
    try {
      const result = await createMacro.mutateAsync({
        body: {
          name: newName.trim(),
          language: newLanguage,
          code: encodeBase64(getDefaultCode(newLanguage, session?.user.name ?? "Unknown")),
        },
      });
      const cell: MacroCell = {
        id: crypto.randomUUID(),
        type: "macro",
        isCollapsed: false,
        payload: {
          macroId: result.body.id,
          language: newLanguage,
          name: newName.trim(),
        },
      };
      onSelect(cell);
      resetAndClose();
    } catch {
      // Hook handles error toasts
    } finally {
      setIsCreating(false);
    }
  };

  const resetAndClose = () => {
    setOpen(false);
    setSearch("");
    setShowCreate(false);
    setNewName("");
    setNewLanguage("python");
  };

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) resetAndClose();
      }}
    >
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="start" side="bottom">
        <div className="space-y-3">
          {showCreate ? (
            <>
              <p className="text-sm font-medium">Create new macro</p>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Macro name"
                className="h-8 text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleCreate();
                }}
                autoFocus
              />
              <Select value={newLanguage} onValueChange={(v) => setNewLanguage(v as MacroLanguage)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["python", "r", "javascript"] as const).map((lang) => (
                    <SelectItem key={lang} value={lang}>
                      {languageLabels[lang]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowCreate(false)}>
                  Back
                </Button>
                <Button
                  size="sm"
                  onClick={() => void handleCreate()}
                  disabled={!newName.trim() || isCreating}
                >
                  {isCreating && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
                  Create
                </Button>
              </div>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                className="w-full justify-start gap-2 text-sm"
                onClick={() => setShowCreate(true)}
              >
                <Plus className="h-4 w-4 text-[#6C5CE7]" />
                Create new macro
              </Button>

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="text-muted-foreground absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search macros..."
                    className="h-8 pl-8 text-sm"
                  />
                </div>
                <Select
                  value={language ?? "all"}
                  onValueChange={(v) => setLanguage(v === "all" ? undefined : (v as MacroLanguage))}
                >
                  <SelectTrigger className="h-8 w-[90px] text-xs">
                    <SelectValue placeholder="Lang" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {(["python", "r", "javascript"] as const).map((lang) => (
                      <SelectItem key={lang} value={lang}>
                        {languageLabels[lang]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="max-h-[240px] space-y-0.5 overflow-y-auto">
                {macros && macros.length > 0 ? (
                  macros.map((m) => (
                    <button
                      type="button"
                      key={m.id}
                      className="hover:bg-accent flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors"
                      onClick={() => handleSelect(m)}
                    >
                      <Code className="h-3.5 w-3.5 shrink-0 text-[#6C5CE7]" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">{m.name}</p>
                        {m.createdByName && (
                          <p className="text-muted-foreground truncate text-xs">
                            by {m.createdByName}
                          </p>
                        )}
                      </div>
                      <Badge variant="outline" className="shrink-0 text-[10px]">
                        {languageLabels[m.language]}
                      </Badge>
                    </button>
                  ))
                ) : (
                  <p className="text-muted-foreground py-3 text-center text-xs">
                    {search ? "No macros found" : "No macros available"}
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
