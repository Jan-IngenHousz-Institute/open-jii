import { zodResolver } from "@hookform/resolvers/zod";
import { MessageSquare } from "lucide-react";
import React from "react";
import { useForm } from "react-hook-form";
import z from "zod";
import { useExperimentAddAnnotation } from "~/hooks/experiment/useExperimentAddAnnotation/useExperimentAddAnnotation";
import { useExperimentAddAnnotationsBulk } from "~/hooks/experiment/useExperimentAddAnnotationsBulk/useExperimentAddAnnotationsBulk";

import type {
  AddAnnotationBody,
  AddAnnotationsBulkBody,
  AnnotationContent,
  AnnotationType,
} from "@repo/api";
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
  DialogTrigger,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Textarea,
} from "@repo/ui/components";
import { toast } from "@repo/ui/hooks";

export interface AddAnnotationDialogProps {
  experimentId: string;
  tableName: string;
  rowIds: string[];
  type: AnnotationType;
  bulk?: boolean;
  bulkOpen?: boolean;
  setBulkOpen?: (value: React.SetStateAction<boolean>) => void;
  clearSelection?: () => void;
}

const zAddAnnotationFormSchema = z.object({
  text: z.string().min(1).max(255),
});
export type AddAnnotationDialogFormType = z.infer<typeof zAddAnnotationFormSchema>;

export function AddAnnotationDialog({
  experimentId,
  tableName,
  rowIds,
  type,
  bulk,
  bulkOpen,
  setBulkOpen,
  clearSelection,
}: AddAnnotationDialogProps) {
  const { mutateAsync: addAnnotation, isPending: isPendingSingle } = useExperimentAddAnnotation();
  const { mutateAsync: addAnnotationsBulk, isPending: isPendingBulk } =
    useExperimentAddAnnotationsBulk();
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);

  const bulkSuffix = bulk ? "Bulk" : "";
  const count = rowIds.length;
  const isPending = bulk ? isPendingBulk : isPendingSingle;
  const pendingSuffix = isPending ? "Pending" : "";

  const form = useForm<AddAnnotationDialogFormType>({
    resolver: zodResolver(zAddAnnotationFormSchema),
    defaultValues: { text: "" },
  });

  async function onSubmit(formData: AddAnnotationDialogFormType) {
    const content: AnnotationContent = {
      text: formData.text,
    };
    if (bulk) {
      const data: AddAnnotationsBulkBody = {
        tableName,
        rowIds,
        annotation: {
          type,
          content,
        },
      };
      await addAnnotationsBulk({
        params: { id: experimentId },
        body: data,
      });
    } else {
      const data: AddAnnotationBody = {
        tableName,
        rowId: rowIds[0],
        annotation: {
          type,
          content,
        },
      };
      await addAnnotation({
        params: { id: experimentId },
        body: data,
      });
    }
    toast({ description: t("experimentDataAnnotations.updated") });
    if (setBulkOpen !== undefined) {
      setBulkOpen(false);
    } else {
      setOpen(false);
    }
    if (clearSelection) {
      clearSelection();
    }
  }

  return (
    <Dialog open={bulkOpen ?? open} onOpenChange={setBulkOpen ?? setOpen}>
      {!bulk && (
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            aria-label={t(`experimentDataAnnotations.${type}Dialog${bulkSuffix}.title`)}
          >
            {type === "comment" && <MessageSquare className="h-4 w-4" />}
          </Button>
        </DialogTrigger>
      )}
      <DialogContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle>
                {t(`experimentDataAnnotations.${type}Dialog${bulkSuffix}.title`)}
              </DialogTitle>
              <DialogDescription>
                {t(`experimentDataAnnotations.${type}Dialog${bulkSuffix}.description`, { count })}
              </DialogDescription>
            </DialogHeader>
            <div className="mb-4 grid gap-4">
              <div className="grid gap-3">
                <FormField
                  control={form.control}
                  name="text"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t(`experimentDataAnnotations.${type}Dialog${bulkSuffix}.textLabel`)}
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          value={field.value}
                          onChange={field.onChange}
                          rows={4}
                          placeholder={t(
                            `experimentDataAnnotations.${type}Dialog${bulkSuffix}.textPlaceholder`,
                          )}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">{t("common.cancel")}</Button>
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
