"use client";

import { CheckCircle2, Hash, HelpCircle, List, Pencil, Send, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import type {
  QuestionCell as QuestionCellType,
  WorkbookCell,
} from "@repo/api/domains/workbook/workbook-cells.schema";
import { Button } from "@repo/ui/components/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@repo/ui/components/dialog";
import { Input } from "@repo/ui/components/input";
import { Switch } from "@repo/ui/components/switch";
import { Textarea } from "@repo/ui/components/textarea";
import { cn } from "@repo/ui/lib/utils";

import { SelectOptionsEditor } from "../../question-card/select-options-editor/select-options-editor";
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

  useEffect(() => {
    if (promptOpen && !isAnswering) {
      setIsAnswering(true);
      setPendingAnswer(cell.answer ?? "");
    }
  }, [promptOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTextChange = useCallback(
    (text: string) => {
      onUpdate({ ...cell, question: { ...question, text } });
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
      onUpdate({ ...cell, question: { ...question, required } });
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
    onUpdate({ ...cell, question: { ...question, options: [...question.options, ""] } });
  }, [cell, question, onUpdate]);

  const handleRemoveOption = useCallback(
    (index: number) => {
      if (question.kind !== "multi_choice") return;
      onUpdate({
        ...cell,
        question: { ...question, options: question.options.filter((_, i) => i !== index) },
      });
    },
    [cell, question, onUpdate],
  );

  const handleBulkAddOptions = useCallback(
    (newOptions: string[]) => {
      if (question.kind !== "multi_choice") return;
      onUpdate({
        ...cell,
        question: { ...question, options: [...question.options, ...newOptions] },
      });
    },
    [cell, question, onUpdate],
  );

  const handleDeleteAllOptions = useCallback(() => {
    if (question.kind !== "multi_choice") return;
    onUpdate({ ...cell, question: { ...question, options: [] } });
  }, [cell, question, onUpdate]);

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

  return (
    <>
      <Dialog open={isAnswering} onOpenChange={(open) => !open && handleCancelAnswer()}>
        <DialogContent className="border-border gap-0 overflow-hidden rounded-xl p-0 sm:max-w-md">
          <div className="from-primary to-primary/80 bg-gradient-to-br px-6 py-5">
            <div className="flex items-start gap-3">
              <div className="bg-primary-foreground/15 mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full">
                {question.kind === "yes_no" && (
                  <CheckCircle2 className="text-primary-foreground size-4" />
                )}
                {question.kind === "open_ended" && (
                  <Pencil className="text-primary-foreground size-4" />
                )}
                {question.kind === "multi_choice" && (
                  <List className="text-primary-foreground size-4" />
                )}
                {question.kind === "number" && <Hash className="text-primary-foreground size-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <DialogHeader>
                  <DialogTitle className="text-primary-foreground text-base font-semibold leading-snug">
                    {question.text || "Untitled question"}
                  </DialogTitle>
                </DialogHeader>
                {question.required && (
                  <p className="text-primary-foreground/70 mt-1 text-xs">Required</p>
                )}
              </div>
            </div>
          </div>

          <div className="px-6 py-5">
            {question.kind === "yes_no" && (
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    "h-auto flex-1 py-3",
                    pendingAnswer === "Yes" && "border-primary bg-accent text-primary",
                  )}
                  onClick={() => setPendingAnswer("Yes")}
                >
                  <CheckCircle2 className="size-4" />
                  Yes
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    "h-auto flex-1 py-3",
                    pendingAnswer === "No" &&
                      "border-node-question bg-node-question/10 text-node-question",
                  )}
                  onClick={() => setPendingAnswer("No")}
                >
                  <X className="size-4" />
                  No
                </Button>
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
                  <Button
                    key={index}
                    type="button"
                    variant="outline"
                    className={cn(
                      "h-auto w-full justify-start p-3 text-left font-normal",
                      pendingAnswer === option && "border-primary bg-accent",
                    )}
                    onClick={() => setPendingAnswer(option)}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                          pendingAnswer === option ? "border-primary bg-primary" : "border-border",
                        )}
                      >
                        {pendingAnswer === option && (
                          <div className="bg-card size-2 rounded-full" />
                        )}
                      </div>
                      <span className="text-foreground text-sm font-medium">{option}</span>
                    </div>
                  </Button>
                ))}
              </div>
            )}
          </div>

          <div className="border-border bg-muted flex items-center justify-end gap-2 border-t px-6 py-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancelAnswer}
              className="text-foreground/60 hover:text-foreground"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSubmitAnswer}
              disabled={question.required && !pendingAnswer.trim()}
            >
              <Send className="mr-1.5 size-3.5" />
              Submit
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
              <Button
                type="button"
                variant="link"
                aria-label={`Rename question (current: ${cell.name})`}
                className="text-node-question h-auto px-0.5 py-0"
              >
                {cell.name}
              </Button>
            </QuestionNameEditor>
          )
        }
        labelText="Question"
        accentColor="var(--node-question)"
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
          <div className="bg-muted flex items-center gap-0.5 rounded-lg border p-0.5">
            {kindOptions.map(({ kind, label, icon: Icon }) => (
              <Button
                key={kind}
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => handleKindChange(kind)}
                disabled={readOnly}
                className={cn(
                  "flex-1 gap-1.5",
                  question.kind === kind
                    ? "border-primary bg-accent text-primary border"
                    : "text-muted-foreground hover:text-foreground",
                  readOnly && "pointer-events-none",
                )}
              >
                <Icon className="size-3.5" />
                {label}
              </Button>
            ))}
          </div>

          <div className="space-y-1.5">
            <span className="text-foreground flex items-center gap-1 text-xs font-semibold uppercase tracking-wide">
              Question text
              <span className="text-node-question" aria-hidden="true">
                *
              </span>
            </span>
            <Input
              value={question.text}
              onChange={(e) => handleTextChange(e.target.value)}
              placeholder="Type your question here..."
              className="border-node-question/40 bg-card placeholder:text-muted-foreground/60 focus-visible:ring-node-question/30 text-sm"
              disabled={readOnly}
              aria-label="Question text"
            />
            {!readOnly && (
              <p className="text-muted-foreground text-xs">
                Shown to participants when they answer. The label above is the data column name.
              </p>
            )}
          </div>

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
            <SelectOptionsEditor
              options={question.options}
              onAddOption={handleAddOption}
              onUpdateOption={handleOptionChange}
              onDeleteOption={handleRemoveOption}
              onBulkAddOptions={handleBulkAddOptions}
              onDeleteAllOptions={handleDeleteAllOptions}
              disabled={readOnly}
            />
          )}
        </div>
      </CellWrapper>
    </>
  );
}
