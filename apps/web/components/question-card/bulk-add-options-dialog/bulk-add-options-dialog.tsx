import React, { useState } from "react";

import { useTranslation } from "@repo/i18n";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components";

interface BulkAddOptionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddOptions: (options: string[]) => void;
}

export function BulkAddOptionsDialog({
  open,
  onOpenChange,
  onAddOptions,
}: BulkAddOptionsDialogProps) {
  const { t } = useTranslation(["experiments"]);
  const [bulkText, setBulkText] = useState("");

  const handleAdd = () => {
    const options = bulkText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (options.length > 0) {
      onAddOptions(options);
      setBulkText("");
      onOpenChange(false);
    }
  };

  const handleCancel = () => {
    setBulkText("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{t("questionCard.bulkAdd.title")}</DialogTitle>
          <DialogDescription>{t("questionCard.bulkAdd.description")}</DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder={t("questionCard.bulkAdd.placeholder")}
            className="focus:border-jii-dark-green focus:ring-jii-dark-green/20 min-h-[300px] w-full rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2"
          />
          <p className="mt-2 text-xs text-gray-500">{t("questionCard.bulkAdd.hint")}</p>
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            {t("questionCard.bulkAdd.cancel")}
          </button>
          <button
            type="button"
            onClick={handleAdd}
            disabled={!bulkText.trim()}
            className="bg-jii-dark-green hover:bg-jii-dark-green/90 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t("questionCard.bulkAdd.add")}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
