"use client";

import { CheckCircle2, Hash, HelpCircle, List, Pencil, Plus, Send, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import type {
  QuestionCell as QuestionCellType,
  WorkbookCell,
} from "@repo/api/schemas/workbook-cells.schema";
import { Button } from "@repo/ui/components/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@repo/ui/components/dialog";
import { Input } from "@repo/ui/components/input";
import { Switch } from "@repo/ui/components/switch";
import { Textarea } from "@repo/ui/components/textarea";
import { cn } from "@repo/ui/lib/utils";

import { CellWrapper } from "../cell-wrapper";
import { QuestionNameEditor } from "../question-name-editor";

interface QuestionCellProps {
  cell: QuestionCellType;
  onUpdate: (cell: QuestionCellType) => void;
  onDelete: () => void;
  onRun?: () => void;
  executionStatus?: "idle" | "running" | "completed" | "error";
  executionError?: string;
  promptOpen?: boolean;
  onQuestionAnswered?: (answer: string) => void;
  allCells?: WorkbookCell[];
  readOnly?: boolean;
}

type QuestionKind = "yes_no" | "open_ended" | "multi_choice" | "number";

const kindOptions: { kind: QuestionKind; label: string; icon: typeof HelpCircle }[] = [
  { kind: "yes_no", label: "Yes / No", icon: CheckCircle2 },
  { kind: "open_ended", label: "Text", icon: Pencil },
  { kind: "multi_choice", label: "Choice", icon: List },
  { kind: "number", label: "Number", icon: Hash },
];

export function QuestionCellComponent({
  cell,
  onUpdate,
  onDelete,
  onRun,
  executionStatus,
  executionError,
  promptOpen,
  onQuestionAnswered,
  allCells = [],
  readOnly,
}: QuestionCellProps) {
  const question = cell.question;

  const [isAnswering, setIsAnswering] = useState(false);
  const [pendingAnswer, setPendingAnswer] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");

  // Above this, the per-option inputs are replaced by a summary + the list editor, so a large
  // choice set (e.g. thousands of plots) does not render thousands of inputs and freeze the cell.
  const MAX_INLINE_OPTIONS = 25;

  useEffect(() => {
    if (promptOpen && !isAnswering) {
      setIsAnswering(true);
      setPendingAnswer(cell.answer ?? "");
    }
  }, [promptOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTextChange = useCallback(
    (text: string) => {
      onUpdate({ ...cell, question: { ...question, text } as typeof question });
    },
    [cell, question, onUpdate],
  );

  const handleNameRename = useCallback(
    (name: string) => {
      onUpdate({ ...cell, name });
    },
    [cell, onUpdate],
  );

  const handleRequiredToggle = useCallback(
    (required: boolean) => {
      onUpdate({ ...cell, question: { ...question, required } as typeof question });
    },
    [cell, question, onUpdate],
  );

  const handleKindChange = useCallback(
    (kind: QuestionKind) => {
      const base = { text: question.text, required: question.required };
      let newQuestion: QuestionCellType["question"];

      switch (kind) {
        case "yes_no":
          newQuestion = { kind: "yes_no", ...base };
          break;
        case "open_ended":
          newQuestion = { kind: "open_ended", ...base };
          break;
        case "multi_choice":
          newQuestion = {
            kind: "multi_choice",
            ...base,
            options: question.kind === "multi_choice" ? question.options : ["Option 1"],
          };
          break;
        case "number":
          newQuestion = { kind: "number", ...base };
          break;
      }

      onUpdate({ ...cell, question: newQuestion });
    },
    [cell, question, onUpdate],
  );

  const handleOptionChange = useCallback(
    (index: number, value: string) => {
      if (question.kind !== "multi_choice") return;
      const newOptions = [...question.options];
      newOptions[index] = value;
      onUpdate({ ...cell, question: { ...question, options: newOptions } });
    },
    [cell, question, onUpdate],
  );

  const handleAddOption = useCallback(() => {
    if (question.kind !== "multi_choice") return;
    onUpdate({
      ...cell,
      question: {
        ...question,
        options: [...question.options, `Option ${question.options.length + 1}`],
      },
    });
  }, [cell, question, onUpdate]);

  const handleRemoveOption = useCallback(
    (index: number) => {
      if (question.kind !== "multi_choice" || question.options.length <= 1) return;
      onUpdate({
        ...cell,
        question: { ...question, options: question.options.filter((_, i) => i !== index) },
      });
    },
    [cell, question, onUpdate],
  );

  const openBulkEditor = useCallback(() => {
    if (question.kind !== "multi_choice") return;
    setBulkText(question.options.join("\n"));
    setBulkOpen(true);
  }, [question]);

  // Parse a pasted block (one option per line) and replace the option list — the bulk path the
  // legacy flows had, so a large set (e.g. plots) can be added at once instead of one by one.
  const handleBulkApply = useCallback(() => {
    if (question.kind !== "multi_choice") return;
    const parsed = bulkText
      .split("\n")
      .map((line) => line.trim().slice(0, 64))
      .filter((line) => line.length > 0);
    if (parsed.length > 0) {
      onUpdate({ ...cell, question: { ...question, options: parsed } });
    }
    setBulkOpen(false);
  }, [cell, question, onUpdate, bulkText]);

  const handleRunClick = () => {
    setIsAnswering(true);
    setPendingAnswer(cell.answer ?? "");
    onRun?.();
  };

  const handleSubmitAnswer = () => {
    if (question.required && !pendingAnswer.trim()) return;
    onUpdate({ ...cell, answer: pendingAnswer, isAnswered: true });
    onQuestionAnswered?.(pendingAnswer);
    setIsAnswering(false);
  };

  const handleCancelAnswer = () => {
    setIsAnswering(false);
    setPendingAnswer("");
    // Empty string signals cancellation back to a runAll prompt.
    if (promptOpen) onQuestionAnswered?.("");
  };

  const bulkParsedCount = bulkText.split("\n").filter((line) => line.trim().length > 0).length;

  return (
    <>
      <Dialog open={isAnswering} onOpenChange={(open) => !open && handleCancelAnswer()}>
        <DialogContent className="gap-0 overflow-hidden rounded-xl border-[#EDF2F6] p-0 sm:max-w-md">
          <div className="bg-gradient-to-br from-[#005E5E] to-[#1a7a7a] px-6 py-5">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-white/15">
                {question.kind === "yes_no" && <CheckCircle2 className="size-4 text-white" />}
                {question.kind === "open_ended" && <Pencil className="size-4 text-white" />}
                {question.kind === "multi_choice" && <List className="size-4 text-white" />}
                {question.kind === "number" && <Hash className="size-4 text-white" />}
              </div>
              <div className="min-w-0 flex-1">
                <DialogHeader>
                  <DialogTitle className="text-base font-semibold leading-snug text-white">
                    {question.text || "Untitled question"}
                  </DialogTitle>
                </DialogHeader>
                {question.required && <p className="mt-1 text-xs text-[#E2FCFC]/70">Required</p>}
              </div>
            </div>
          </div>

          <div className="px-6 py-5">
            {question.kind === "yes_no" && (
              <div className="flex gap-3">
                <button
                  type="button"
                  className={cn(
                    "flex flex-1 items-center justify-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-all",
                    pendingAnswer === "Yes"
                      ? "border-[#005E5E] bg-[#E2FCFC] text-[#005E5E]"
                      : "border-[#EDF2F6] hover:border-[#005E5E]/30 hover:bg-[#E2FCFC]/30",
                  )}
                  onClick={() => setPendingAnswer("Yes")}
                >
                  <CheckCircle2 className="size-4" />
                  Yes
                </button>
                <button
                  type="button"
                  className={cn(
                    "flex flex-1 items-center justify-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-all",
                    pendingAnswer === "No"
                      ? "border-[#C58AAE] bg-[#C58AAE]/10 text-[#C58AAE]"
                      : "border-[#EDF2F6] hover:border-[#C58AAE]/30 hover:bg-[#C58AAE]/5",
                  )}
                  onClick={() => setPendingAnswer("No")}
                >
                  <X className="size-4" />
                  No
                </button>
              </div>
            )}

            {question.kind === "open_ended" && (
              <Textarea
                value={pendingAnswer}
                onChange={(e) => setPendingAnswer(e.target.value)}
                placeholder="Type your answer..."
                className="min-h-24 resize-none"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && e.metaKey) handleSubmitAnswer();
                }}
              />
            )}

            {question.kind === "number" && (
              <Input
                type="number"
                value={pendingAnswer}
                onChange={(e) => setPendingAnswer(e.target.value)}
                placeholder="0"
                className="text-center text-lg"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSubmitAnswer();
                }}
              />
            )}

            {question.kind === "multi_choice" && (
              <div className="space-y-2">
                {question.options.map((option, index) => (
                  <button
                    key={index}
                    type="button"
                    className={cn(
                      "w-full rounded-lg border-2 p-3 text-left transition-all",
                      pendingAnswer === option
                        ? "border-[#005E5E] bg-[#E2FCFC]"
                        : "border-[#EDF2F6] hover:border-[#005E5E]/30 hover:bg-[#E2FCFC]/30",
                    )}
                    onClick={() => setPendingAnswer(option)}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                          pendingAnswer === option
                            ? "border-[#005E5E] bg-[#005E5E]"
                            : "border-[#CDD5DB]",
                        )}
                      >
                        {pendingAnswer === option && (
                          <div className="size-2 rounded-full bg-white" />
                        )}
                      </div>
                      <span className="text-foreground text-sm font-medium">{option}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-[#EDF2F6] bg-[#FAFBFC] px-6 py-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancelAnswer}
              className="text-[#011111]/60 hover:text-[#011111]"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSubmitAnswer}
              disabled={question.required && !pendingAnswer.trim()}
              className="bg-[#005E5E] text-white hover:bg-[#004a4a]"
            >
              <Send className="mr-1.5 size-3.5" />
              Submit
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="gap-3 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit options as a list</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-xs">
            One option per line. Paste a column from a spreadsheet to add many at once (each line is
            trimmed to 64 characters). Saving replaces the current options.
          </p>
          <Textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder={"Plot 1\nPlot 2\nPlot 3"}
            className="max-h-72 min-h-48 font-mono text-xs"
            autoFocus
          />
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setBulkOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-[#005E5E] text-white hover:bg-[#004a4a]"
              onClick={handleBulkApply}
              disabled={bulkParsedCount === 0}
            >
              Save {bulkParsedCount} option{bulkParsedCount === 1 ? "" : "s"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <CellWrapper
        icon={<HelpCircle className="h-3.5 w-3.5" />}
        label={
          readOnly ? (
            cell.name
          ) : (
            <QuestionNameEditor
              initialName={cell.name}
              cellId={cell.id}
              existingCells={allCells}
              onRename={handleNameRename}
            >
              <button
                type="button"
                aria-label={`Rename question (current: ${cell.name})`}
                className="cursor-pointer rounded px-0.5 hover:underline focus:outline-none focus-visible:underline"
                style={{ color: "#C58AAE" }}
              >
                {cell.name}
              </button>
            </QuestionNameEditor>
          )
        }
        labelText="Question"
        accentColor="#C58AAE"
        isCollapsed={cell.isCollapsed}
        onToggleCollapse={(collapsed) => onUpdate({ ...cell, isCollapsed: collapsed })}
        onDelete={onDelete}
        onRun={handleRunClick}
        executionStatus={executionStatus}
        executionError={executionError}
        readOnly={readOnly}
        headerBadges={undefined}
      >
        <div className="space-y-3">
          <div className="flex items-center gap-0.5 rounded-lg border bg-[#EDF2F6] p-0.5">
            {kindOptions.map(({ kind, label, icon: Icon }) => (
              <button
                key={kind}
                type="button"
                onClick={() => handleKindChange(kind)}
                disabled={readOnly}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-all",
                  question.kind === kind
                    ? "shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                  readOnly && "pointer-events-none",
                )}
                style={
                  question.kind === kind
                    ? { backgroundColor: "#E2FCFC", color: "#005E5E", border: "1px solid #005E5E" }
                    : undefined
                }
              >
                <Icon className="size-3.5" />
                {label}
              </button>
            ))}
          </div>

          <Input
            value={question.text}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder="Type your question here..."
            className="border-[#CDD5DB] bg-white text-sm placeholder:text-[#CDD5DB]"
            disabled={readOnly}
          />

          {!readOnly && (
            <label className="text-muted-foreground flex items-center gap-2 text-xs">
              <Switch
                checked={question.required}
                onCheckedChange={handleRequiredToggle}
                className="scale-75"
              />
              <span>Required</span>
            </label>
          )}

          {question.kind === "multi_choice" && (
            <div className="space-y-1.5 pl-1">
              {question.options.length <= MAX_INLINE_OPTIONS ? (
                question.options.map((option, index) => (
                  <div key={index} className="group/opt flex items-center gap-2">
                    <div
                      className="flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                      style={{
                        backgroundColor: "rgba(197, 138, 174, 0.15)",
                        color: "#C58AAE",
                      }}
                    >
                      {index + 1}
                    </div>
                    <Input
                      value={option}
                      onChange={(e) => handleOptionChange(index, e.target.value)}
                      placeholder={`Option ${index + 1}`}
                      className="focus-visible:border-input focus-visible:bg-background h-8 flex-1 border-transparent bg-transparent text-sm shadow-none"
                      disabled={readOnly}
                    />
                    {!readOnly && question.options.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-destructive h-6 w-6 p-0 opacity-0 transition-opacity group-hover/opt:opacity-100"
                        onClick={() => handleRemoveOption(index)}
                      >
                        <X className="size-3" />
                      </Button>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-muted-foreground rounded-lg border border-dashed border-[#CDD5DB] px-3 py-2 text-xs">
                  {question.options.length} options. Use the list editor to view or change them.
                </div>
              )}
              {!readOnly && (
                <div className="flex flex-wrap items-center gap-2">
                  {question.options.length <= MAX_INLINE_OPTIONS && (
                    <button
                      type="button"
                      className="flex items-center gap-2 rounded-lg bg-[#EDF2F6] px-3 py-2 text-xs font-medium text-[#011111] transition-colors"
                      onClick={handleAddOption}
                    >
                      <Plus className="size-3.5" />
                      Add option
                    </button>
                  )}
                  <button
                    type="button"
                    className="flex items-center gap-2 rounded-lg bg-[#EDF2F6] px-3 py-2 text-xs font-medium text-[#011111] transition-colors"
                    onClick={openBulkEditor}
                  >
                    <List className="size-3.5" />
                    Edit as list
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </CellWrapper>
    </>
  );
}
