"use client";

import { useDatasetReturn } from "@/hooks/dataset/useDatasetReturn/useDatasetReturn";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import type { ReturnDatasetBody } from "@repo/api/domains/dataset/dataset.schema";
import { zReturnDatasetBody } from "@repo/api/domains/dataset/dataset.schema";
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
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@repo/ui/components/form";
import { Textarea } from "@repo/ui/components/textarea";

interface ReturnDatasetDialogProps {
  datasetId: string;
  version: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReturned: () => void;
}

/** As the withdraw dialog asks, with the reason the researcher reads on the dataset's row. */
export function ReturnDatasetDialog({
  datasetId,
  version,
  open,
  onOpenChange,
  onReturned,
}: ReturnDatasetDialogProps) {
  const { t } = useTranslation("datasets");
  const form = useForm<ReturnDatasetBody>({
    resolver: zodResolver(zReturnDatasetBody),
    defaultValues: { reason: "" },
  });
  const reason = form.watch("reason");
  const hasReason = reason.trim() !== "";

  const handleClose = () => {
    onOpenChange(false);
    form.reset();
  };

  const { mutate: returnDataset, isPending } = useDatasetReturn({ onSuccess: onReturned });

  const handleSubmit = (body: ReturnDatasetBody) => {
    returnDataset({ ...body, id: datasetId });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-testid="return-dataset-dialog">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{t("review.returnTitle", { version })}</DialogTitle>
              <DialogDescription>{t("review.returnDescription")}</DialogDescription>
            </DialogHeader>

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("review.reasonLabel")}</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} />
                  </FormControl>
                  <FormDescription>{t("review.reasonHelp")}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose} disabled={isPending}>
                {t("review.cancel")}
              </Button>
              <Button type="submit" disabled={!hasReason || isPending}>
                {t("review.confirmReturn", { version })}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
