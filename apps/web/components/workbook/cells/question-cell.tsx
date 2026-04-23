"use client";

import { CheckCircle2, Hash, HelpCircle, List, Pencil, Plus, Send, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import type { QuestionCell as QuestionCellType } from "@repo/api";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Switch,
  Textarea,
} from "@repo/ui/components";
import { cn } from "@repo/ui/lib/utils";

import { CellWrapper } from "../cell-wrapper";

interface QuestionCellProps {
  cell: QuestionCellType;
  onUpdate: (cell: QuestionCellType) => void;
  onDelete: () => void;
  onRun?: () => void;
  executionStatus?: "idle" | "running" | "completed" | "error";
  executionError?: string;
  /** When true, auto-open the answer dialog (triggered by runAll) */
  promptOpen?: boolean;
  /** Called when the user submits an answer during a prompted run */
  onQuestionAnswered?: (answer: string) => void;
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
  readOnly,
}: QuestionCellProps) {
  const question = cell.question;

  const [isAnswering, setIsAnswering] = useState(false);
  const [pendingAnswer, setPendingAnswer] = useState("");

  // Auto-open the dialog when prompted by runAll
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
    // If this was a prompted question during runAll, signal cancellation
    if (promptOpen) onQuestionAnswered?.("");
  };

  return (
    <>
      {/* Answer Modal */}
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

      <CellWrapper
        icon={<HelpCircle className="h-3.5 w-3.5" />}
        label="Question"
        accentColor="#C58AAE"
        isCollapsed={cell.isCollapsed}
        onToggleCollapse={(collapsed) => onUpdate({ ...cell, isCollapsed: collapsed })}
        onDelete={onDelete}
        onRun={handleRunClick}
        executionStatus={executionStatus}
        executionError={executionError}
        readOnly={readOnly}
        headerBadges={undefined}
        headerActions={
          <div className="text-muted-foreground flex items-center gap-1 text-xs">
            <span>Required</span>
            <Switch
              checked={question.required}
              onCheckedChange={handleRequiredToggle}
              className="scale-75"
              disabled={readOnly}
            />
          </div>
        }
      >
        <div className="space-y-3">
          {/* Answer type - compact segmented control */}
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

          {/* Question text - prominent, clean */}
          <Input
            value={question.text}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder="Type your question here..."
            className="border-[#CDD5DB] bg-white text-sm placeholder:text-[#CDD5DB]"
            disabled={readOnly}
          />

          {/* Multi-choice options */}
          {question.kind === "multi_choice" && (
            <div className="space-y-1.5 pl-1">
              {question.options.map((option, index) => (
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
              ))}
              {!readOnly && (
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-lg bg-[#EDF2F6] px-3 py-2 text-xs font-medium text-[#011111] transition-colors"
                  onClick={handleAddOption}
                >
                  <Plus className="size-3.5" />
                  Add option
                </button>
              )}
            </div>
          )}
        </div>
      </CellWrapper>
    </>
  );
}
