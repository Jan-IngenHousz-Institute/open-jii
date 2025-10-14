import { zodResolver } from "@hookform/resolvers/zod";
import { Flag, MessageSquare } from "lucide-react";
import React from "react";
import { useForm } from "react-hook-form";
import z from "zod";

import type { AnnotationType } from "@repo/api";
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
}: AddAnnotationDialogProps) {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);

  const count = rowIds.length;

  const form = useForm<AddAnnotationDialogFormType>({
    resolver: zodResolver(
      type === "flag"
        ? zAddAnnotationFormSchema.extend({ flag: zAnnotationFlagType })
        : zAddAnnotationFormSchema,
    ),
    defaultValues: type === "flag" ? { text: "", flag: undefined } : { text: "" },
  });

  function onSubmit(formData: AddAnnotationDialogFormType) {
    // TODO: Implement API call to add annotation and remove logging statement
    console.log("onSubmit", { formData, experimentId, tableName, rowIds, type });
    toast({ description: t("experimentDataAnnotations.updated") });
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={
            type === "comment"
              ? t("experimentDataAnnotations.commentDialog.title")
              : t("experimentDataAnnotations.flagDialog.title")
          }
        >
          {type === "comment" && <MessageSquare className="h-4 w-4" />}
          {type === "flag" && <Flag className="h-4 w-4" />}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle>{t(`experimentDataAnnotations.${type}Dialog.title`)}</DialogTitle>
              <DialogDescription>
                {t(`experimentDataAnnotations.${type}Dialog.description`, { count })}
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
                          {t(`experimentDataAnnotations.${type}Dialog.flagLabel`)}
                        </FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="w-[180px]">
                              <SelectValue
                                placeholder={t(
                                  `experimentDataAnnotations.${type}Dialog.flagPlaceholder`,
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
                        {t(`experimentDataAnnotations.${type}Dialog.textLabel`)}
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          value={field.value}
                          onChange={field.onChange}
                          rows={4}
                          placeholder={t(`experimentDataAnnotations.${type}Dialog.textPlaceholder`)}
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
                {t(`experimentDataAnnotations.${type}Dialog.add`, { count })}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
