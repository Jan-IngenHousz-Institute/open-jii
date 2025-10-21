import { zodResolver } from "@hookform/resolvers/zod";
import { Flag, MessageSquare } from "lucide-react";
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
import { zAnnotationFlagType } from "@repo/api";
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
  Select,
  SelectContent,
  SelectGroup,
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
  bulk?: boolean;
  bulkOpen?: boolean;
  setBulkOpen?: (value: React.SetStateAction<boolean>) => void;
  clearSelection?: () => void;
}

const zAddAnnotationFormSchema = z.object({
  flag: zAnnotationFlagType.optional(),
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
  const { mutateAsync: addAnnotation } = useExperimentAddAnnotation();
  const { mutateAsync: addAnnotationsBulk } = useExperimentAddAnnotationsBulk();
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);

  const bulkSuffix = bulk ? "Bulk" : "";
  const count = rowIds.length;

  const form = useForm<AddAnnotationDialogFormType>({
    resolver: zodResolver(
      type === "flag"
        ? zAddAnnotationFormSchema.extend({ flag: zAnnotationFlagType })
        : zAddAnnotationFormSchema,
    ),
    defaultValues: type === "flag" ? { text: "", flag: undefined } : { text: "" },
  });

  async function onSubmit(formData: AddAnnotationDialogFormType) {
    const content: AnnotationContent =
      type === "flag" && formData.flag
        ? {
            reason: formData.text,
            flagType: formData.flag,
          }
        : {
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
      toast({ description: t("experimentDataAnnotations.updated") });
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
      toast({ description: t("experimentDataAnnotations.updated") });
    }
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
            {type === "flag" && <Flag className="h-4 w-4" />}
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
              {type === "flag" && (
                <div className="grid gap-3">
                  <FormField
                    control={form.control}
                    name="flag"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {t(`experimentDataAnnotations.${type}Dialog${bulkSuffix}.flagLabel`)}
                        </FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="w-[180px]">
                              <SelectValue
                                placeholder={t(
                                  `experimentDataAnnotations.${type}Dialog${bulkSuffix}.flagPlaceholder`,
                                )}
                              />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectGroup>
                              <SelectItem value="needs_review">
                                {t(`experimentDataAnnotations.flagType.needs_review`)}
                              </SelectItem>
                              <SelectItem value="outlier">
                                {t(`experimentDataAnnotations.flagType.outlier`)}
                              </SelectItem>
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                </div>
              )}
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
              <Button type="submit">
                {t(`experimentDataAnnotations.${type}Dialog${bulkSuffix}.add`, { count })}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
