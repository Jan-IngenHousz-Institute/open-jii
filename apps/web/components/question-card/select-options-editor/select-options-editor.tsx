import React, { useState } from "react";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";

import { BulkAddOptionsDialog } from "../bulk-add-options-dialog/bulk-add-options-dialog";
import { DeleteAllOptionsDialog } from "../delete-all-options-dialog/delete-all-options-dialog";

// Keep in sync with the option length limit in zQuestionMultiChoice (packages/api).
const OPTION_MAX_LENGTH = 64;

// Above this many options the per-option inputs collapse to a summary so a
// pasted spreadsheet column of thousands of options doesn't freeze the editor.
const LARGE_OPTION_COUNT = 25;

interface SelectOptionsEditorProps {
  options?: string[];
  onAddOption?: () => void;
  onUpdateOption?: (optionIndex: number, text: string) => void;
  onDeleteOption?: (optionIndex: number) => void;
  onBulkAddOptions?: (options: string[]) => void;
  onDeleteAllOptions?: () => void;
  disabled?: boolean;
}

export function SelectOptionsEditor({
  options = [],
  onAddOption,
  onUpdateOption,
  onDeleteOption,
  onBulkAddOptions,
  onDeleteAllOptions,
  disabled = false,
}: SelectOptionsEditorProps) {
  const { t } = useTranslation(["experiments"]);
  const [showBulkAddDialog, setShowBulkAddDialog] = useState(false);
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);

  const handleBulkAdd = (newOptions: string[]) => {
    onBulkAddOptions?.(newOptions);
  };

  const handleDeleteAll = () => {
    onDeleteAllOptions?.();
    setShowDeleteAllDialog(false);
  };

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-muted-foreground h-1 w-1 rounded-full"></div>
            <span className="text-muted-foreground text-sm font-medium">
              {t("questionCard.answerOptionsLabel")}
            </span>
          </div>

          {options.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => setShowDeleteAllDialog(true)}
              disabled={disabled}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              {t("questionCard.deleteAllOptions")}
            </Button>
          )}
        </div>

        <p className="text-muted-foreground text-xs">
          {t("questionCard.optionCharLimitHint", { max: OPTION_MAX_LENGTH })}
        </p>

        {options.length > 0 ? (
          options.length > LARGE_OPTION_COUNT ? (
            <div className="border-border bg-muted flex items-center justify-between gap-3 rounded-lg border px-4 py-3">
              <div className="min-w-0">
                <p className="text-foreground text-sm font-medium">
                  {t("questionCard.optionCount", { count: options.length })}
                </p>
                <p className="text-muted-foreground truncate text-xs">
                  {options.slice(0, 4).join(", ")}…
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {options.map((option, optionIndex) => (
                <div key={optionIndex} className="group/option flex items-center gap-3">
                  <div className="bg-muted text-muted-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium">
                    {optionIndex + 1}
                  </div>
                  <Input
                    type="text"
                    value={option}
                    onChange={(e) => onUpdateOption?.(optionIndex, e.target.value)}
                    placeholder={t("questionCard.answerOptionPlaceholder")}
                    disabled={disabled}
                    maxLength={OPTION_MAX_LENGTH}
                    className="flex-1"
                  />
                  <span
                    className="text-muted-foreground w-12 shrink-0 text-right text-xs tabular-nums"
                    title={t("questionCard.optionCharLimitHint", { max: OPTION_MAX_LENGTH })}
                  >
                    {option.length}/{OPTION_MAX_LENGTH}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onDeleteOption?.(optionIndex)}
                    disabled={disabled}
                    className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive opacity-100 md:opacity-0 md:group-hover/option:opacity-100"
                    title={t("questionCard.removeOption")}
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </Button>
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="border-border rounded-lg border-2 border-dashed p-8 text-center">
            <div className="bg-muted mx-auto mb-3 w-fit rounded-full p-3">
              <svg
                className="text-muted-foreground h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
            </div>
            <p className="text-muted-foreground text-sm">{t("questionCard.noAnswerOptions")}</p>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onAddOption}
            disabled={disabled}
            className="flex-1"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
            {t("questionCard.addOption")}
          </Button>

          <Button
            type="button"
            onClick={() => setShowBulkAddDialog(true)}
            disabled={disabled}
            className="flex-1"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            {t("questionCard.bulkAddOptions")}
          </Button>
        </div>
      </div>

      <BulkAddOptionsDialog
        open={showBulkAddDialog}
        onOpenChange={setShowBulkAddDialog}
        onAddOptions={handleBulkAdd}
      />

      <DeleteAllOptionsDialog
        open={showDeleteAllDialog}
        onOpenChange={setShowDeleteAllDialog}
        onConfirm={handleDeleteAll}
        optionCount={options.length}
      />
    </>
  );
}
