import React, { useState } from "react";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import { Textarea } from "@repo/ui/components/textarea";

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
          <Textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder={t("questionCard.bulkAdd.placeholder")}
            className="min-h-[300px] w-full"
          />
          <p className="text-muted-foreground mt-2 text-xs">{t("questionCard.bulkAdd.hint")}</p>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleCancel}>
            {t("questionCard.bulkAdd.cancel")}
          </Button>
          <Button type="button" onClick={handleAdd} disabled={!bulkText.trim()}>
            {t("questionCard.bulkAdd.add")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
