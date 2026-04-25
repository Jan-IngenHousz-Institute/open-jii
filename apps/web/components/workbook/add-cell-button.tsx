"use client";

import { BookOpen, Code, FileText, GitBranch, HelpCircle, Microscope } from "lucide-react";

import type { WorkbookCell } from "@repo/api/schemas/workbook-cells.schema";
import { Button } from "@repo/ui/components/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/components/tooltip";
import { cn } from "@repo/ui/lib/utils";

import { MacroPicker } from "./macro-picker";
import { ProtocolPicker } from "./protocol-picker";

type CellType = WorkbookCell["type"];

interface AddCellButtonProps {
  onAdd: (type: CellType) => void;
  onAddCell?: (cell: WorkbookCell) => void;
  sensorFamily?: "multispeq" | "ambit" | "generic";
  variant?: "inline" | "bottom";
  showBranch?: boolean;
  accentColor?: string;
  showEmptyState?: boolean;
}

const cellOptions: {
  type: CellType;
  label: string;
  icon: typeof FileText;
  color: string;
}[] = [
  { type: "markdown", label: "Markdown", icon: FileText, color: "#6F8596" },
  { type: "protocol", label: "Protocol", icon: Microscope, color: "#2D3142" },
  { type: "macro", label: "Macro", icon: Code, color: "#6C5CE7" },
  { type: "question", label: "Question", icon: HelpCircle, color: "#C58AAE" },
  { type: "branch", label: "Branch", icon: GitBranch, color: "#F29D38" },
];

export function AddCellButton({
  onAdd,
  onAddCell,
  sensorFamily = "multispeq",
  variant = "inline",
  showBranch = true,
  accentColor,
  showEmptyState,
}: AddCellButtonProps) {
  const options = showBranch ? cellOptions : cellOptions.filter((o) => o.type !== "branch");

  const handleClick = (type: CellType) => {
    // Protocol/macro are handled by their pickers when onAddCell is provided
    if (onAddCell && (type === "protocol" || type === "macro")) return;
    onAdd(type);
  };

  const wrapWithPicker = (type: CellType, key: string, button: React.ReactNode) => {
    if (!onAddCell) return button;
    if (type === "protocol") {
      return (
        <ProtocolPicker key={key} sensorFamily={sensorFamily} onSelect={onAddCell}>
          {button}
        </ProtocolPicker>
      );
    }
    if (type === "macro") {
      return (
        <MacroPicker key={key} onSelect={onAddCell}>
          {button}
        </MacroPicker>
      );
    }
    return button;
  };

  if (variant === "bottom") {
    return (
      <div
        className="flex flex-col items-center justify-center gap-3 rounded-lg border border-[#EDF2F6] p-4"
        style={{
          background: "linear-gradient(270.03deg, #F5FFF8 0.02%, #F4F9FF 100.24%)",
          boxShadow: "inset 0px 2px 16px rgba(0, 94, 94, 0.08)",
        }}
      >
        {showEmptyState ? (
          <div className="flex flex-col items-center pb-2 pt-4">
            <BookOpen className="mb-4 size-12 text-[#CDD5DB]" />
            <p className="mb-1 text-sm font-medium text-[#68737B]">Empty workbook</p>
            <p className="text-xs text-[#CDD5DB]">Add a cell to get started</p>
          </div>
        ) : (
          <span className="text-[13px] font-normal leading-[21px] text-[#808080]">Add new</span>
        )}
        <div className="flex flex-wrap items-center justify-center gap-3">
          {options.map((opt) =>
            wrapWithPicker(
              opt.type,
              opt.label,
              <button
                key={opt.label}
                className="inline-flex h-[38px] items-center justify-center gap-1 rounded-lg bg-[#EDF2F6] px-4 text-[13px] font-semibold leading-[18px] text-[#011111]"
                onClick={() => handleClick(opt.type)}
              >
                <opt.icon className="size-4" style={{ color: opt.color }} />
                {opt.label}
              </button>,
            ),
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="group/add py-3">
      <div className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-200 ease-in-out group-hover/add:grid-rows-[1fr] has-[[data-state=open]]:grid-rows-[1fr]">
        <div className="overflow-hidden">
          <div className="relative flex items-center justify-center py-1">
            <div className="border-muted-foreground/20 absolute inset-x-0 left-11 top-1/2 border-t" />
            <div
              className={cn(
                "bg-background relative z-10 flex items-center gap-1 rounded-full border px-1 py-0.5 shadow-sm",
              )}
              style={accentColor ? { borderColor: accentColor + "40" } : undefined}
            >
              <TooltipProvider delayDuration={100}>
                {options.map((opt) => {
                  const button = (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 rounded-full p-0"
                      onClick={() => handleClick(opt.type)}
                    >
                      <opt.icon className="h-3.5 w-3.5" style={{ color: opt.color }} />
                    </Button>
                  );

                  // Protocol/macro buttons get wrapped with picker popovers
                  if (onAddCell && (opt.type === "protocol" || opt.type === "macro")) {
                    return (
                      <Tooltip key={opt.label}>
                        <TooltipTrigger asChild>
                          <div className="inline-flex">
                            {wrapWithPicker(opt.type, opt.label, button)}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs">
                          {opt.label}
                        </TooltipContent>
                      </Tooltip>
                    );
                  }

                  return (
                    <Tooltip key={opt.label}>
                      <TooltipTrigger asChild>{button}</TooltipTrigger>
                      <TooltipContent side="bottom" className="text-xs">
                        {opt.label}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </TooltipProvider>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
