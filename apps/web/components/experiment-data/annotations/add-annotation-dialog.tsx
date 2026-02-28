import { zodResolver } from "@hookform/resolvers/zod";
import React, { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { useExperimentAnnotationAdd } from "~/hooks/experiment/annotations/useExperimentAnnotationAdd/useExperimentAnnotationAdd";
import { useExperimentAnnotationAddBulk } from "~/hooks/experiment/annotations/useExperimentAnnotationAddBulk/useExperimentAnnotationAddBulk";

import type { AnnotationContent, AnnotationType } from "@repo/api";
import { zAnnotationContent } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@repo/ui/components";
import { toast } from "@repo/ui/hooks";

export interface AddAnnotationDialogProps {
  experimentId: string;
  tableName: string;
  rowIds: string[];
  type: AnnotationType;
  open?: boolean;
  setOpen?: (value: React.SetStateAction<boolean>) => void;
  clearSelection?: () => void;
}

export function AddAnnotationDialog({
  experimentId,
  tableName,
  rowIds,
  type,
  open,
  setOpen,
  clearSelection,
}: AddAnnotationDialogProps) {
  const { t } = useTranslation();

  const { mutateAsync: addAnnotation, isPending: isPendingSingle } = useExperimentAnnotationAdd();
  const { mutateAsync: addAnnotationsBulk, isPending: isPendingBulk } =
    useExperimentAnnotationAddBulk();

  const count = rowIds.length;

  const isBulk = count > 1;
  const isPending = isBulk ? isPendingBulk : isPendingSingle;

  const bulkSuffix = isBulk ? "Bulk" : "";
  const pendingSuffix = isPending ? "Pending" : "";

  const defaultValues: Record<AnnotationType, AnnotationContent> = useMemo(
    () => ({
      comment: { type: "comment", text: "" },
      flag: { type: "flag", flagType: "outlier", text: "" },
    }),
    [],
  );

  const form = useForm<AnnotationContent>({
    resolver: zodResolver(zAnnotationContent),
    defaultValues: defaultValues[type],
    mode: "onChange",
  });

  useEffect(() => {
    form.reset(defaultValues[type]);
  }, [defaultValues, type, form]);

  async function handleSubmit(content: AnnotationContent) {
    if (isBulk) {
      await addAnnotationsBulk({
        params: { id: experimentId },
        body: {
          tableName,
          rowIds,
          annotation: {
            type,
            content,
          },
        },
      });
    } else {
      await addAnnotation({
        params: { id: experimentId },
        body: {
          tableName,
          rowId: rowIds[0],
          annotation: {
            type,
            content,
          },
        },
      });
    }

    toast({ description: t("experimentDataAnnotations.updated") });

    setOpen?.(false);
    clearSelection?.();

    form.reset();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-3xl">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)}>
            <DialogHeader>
              <DialogTitle>
                {t(`experimentDataAnnotations.${type}Dialog${bulkSuffix}.title`)}
              </DialogTitle>
              <DialogDescription>
                {t(`experimentDataAnnotations.${type}Dialog${bulkSuffix}.description`, { count })}
              </DialogDescription>
            </DialogHeader>
            <div className="mb-4 grid gap-4">
              {type === "flag" && (
                <FormField
                  control={form.control}
                  name="flagType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("experimentDataAnnotations.flagType")}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue
                              placeholder={t("experimentDataAnnotations.selectFlagType")}
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="outlier">
                            {t("experimentDataAnnotations.flagTypes.outlier")}
                          </SelectItem>
                          <SelectItem value="needs_review">
                            {t("experimentDataAnnotations.flagTypes.needs_review")}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <FormField
                control={form.control}
                name="text"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {type === "comment"
                        ? t(`experimentDataAnnotations.commentDialog${bulkSuffix}.textLabel`)
                        : t("experimentDataAnnotations.flagReason")}
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        value={field.value}
                        onChange={field.onChange}
                        rows={type === "comment" ? 4 : 3}
                        placeholder={
                          type === "comment"
                            ? t(
                                `experimentDataAnnotations.commentDialog${bulkSuffix}.textPlaceholder`,
                              )
                            : t("experimentDataAnnotations.flagReasonPlaceholder")
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  {t("common.cancel")}
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isPending}>
                {t(`experimentDataAnnotations.${type}Dialog${bulkSuffix}.add${pendingSuffix}`, {
                  count,
                })}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
