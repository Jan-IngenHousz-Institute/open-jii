import React, { useState } from "react";

import { useTranslation } from "@repo/i18n";

import { BulkAddOptionsDialog } from "../bulk-add-options-dialog";
import { DeleteAllOptionsDialog } from "../delete-all-options-dialog";

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
            <div className="h-1 w-1 rounded-full bg-gray-400"></div>
            <span className="text-sm font-medium text-gray-600">
              {t("questionCard.answerOptionsLabel")}
            </span>
          </div>

          {options.length > 0 && (
            <button
              type="button"
              onClick={() => setShowDeleteAllDialog(true)}
              disabled={disabled}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("questionCard.deleteAllOptions")}
            </button>
          )}
        </div>

        {options.length > 0 ? (
          <div className="space-y-3">
            {options.map((option, optionIndex) => (
              <div key={optionIndex} className="group/option flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-50 text-xs font-medium text-gray-600">
                  {optionIndex + 1}
                </div>
                <input
                  type="text"
                  value={option}
                  onChange={(e) => onUpdateOption?.(optionIndex, e.target.value)}
                  placeholder={t("questionCard.answerOptionPlaceholder")}
                  disabled={disabled}
                  className="focus:border-jii-dark-green focus:ring-jii-dark-green/20 flex-1 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-500 transition-colors focus:bg-white focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-gray-100"
                />
                <button
                  type="button"
                  onClick={() => onDeleteOption?.(optionIndex)}
                  disabled={disabled}
                  className="rounded-lg p-2 text-gray-400 opacity-100 transition-all hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-50 md:opacity-0 md:group-hover/option:opacity-100"
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
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border-2 border-dashed border-gray-200 p-8 text-center">
            <div className="mx-auto mb-3 w-fit rounded-full bg-gray-100 p-3">
              <svg
                className="h-5 w-5 text-gray-400"
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
            <p className="text-sm text-gray-500">{t("questionCard.noAnswerOptions")}</p>
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onAddOption}
            disabled={disabled}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
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
          </button>

          <button
            type="button"
            onClick={() => setShowBulkAddDialog(true)}
            disabled={disabled}
            className="bg-jii-dark-green hover:bg-jii-dark-green/90 flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
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
          </button>
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
