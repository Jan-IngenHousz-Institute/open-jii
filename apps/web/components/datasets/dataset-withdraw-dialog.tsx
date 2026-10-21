"use client";

import { useDatasetWithdraw } from "@/hooks/dataset/useDatasetWithdraw/useDatasetWithdraw";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import type { Dataset, WithdrawDatasetBody } from "@repo/api/domains/dataset/dataset.schema";
import { zWithdrawDatasetBody } from "@repo/api/domains/dataset/dataset.schema";
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

interface DatasetWithdrawDialogProps {
  dataset: Dataset;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** As the experiment delete dialog confirms, with the reason the tombstone will show. */
export function DatasetWithdrawDialog({ dataset, open, onOpenChange }: DatasetWithdrawDialogProps) {
  const { t } = useTranslation("datasets");
  const form = useForm<WithdrawDatasetBody>({
    resolver: zodResolver(zWithdrawDatasetBody),
    defaultValues: { reason: "" },
  });
  const reason = form.watch("reason");
  const hasReason = reason.trim() !== "";
  const isDeposited = dataset.doi !== null;

  const handleClose = () => {
    onOpenChange(false);
    form.reset();
  };

  const { mutate: withdraw, isPending } = useDatasetWithdraw({ onSuccess: handleClose });

  const handleSubmit = (body: WithdrawDatasetBody) => {
    withdraw({ ...body, id: dataset.id });
  };

  const consequences = [
    t("withdraw.consequences.files"),
    t("withdraw.consequences.tombstone"),
    isDeposited ? t("withdraw.consequences.zenodo") : null,
    isDeposited ? t("withdraw.consequences.doi", { doi: dataset.doi }) : null,
  ].filter((line): line is string => line !== null);

  const renderConsequence = (line: string) => <li key={line}>{line}</li>;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-testid="dataset-withdraw-dialog">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="text-destructive">
                {t("withdraw.title", { version: dataset.version })}
              </DialogTitle>
              <DialogDescription>{t("withdraw.description")}</DialogDescription>
            </DialogHeader>

            <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-sm">
              {consequences.map(renderConsequence)}
            </ul>

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("withdraw.reasonLabel")}</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} />
                  </FormControl>
                  <FormDescription>{t("withdraw.reasonPublic")}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose} disabled={isPending}>
                {t("withdraw.cancel")}
              </Button>
              <Button type="submit" variant="destructive" disabled={!hasReason || isPending}>
                {t("withdraw.confirm", { version: dataset.version })}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
