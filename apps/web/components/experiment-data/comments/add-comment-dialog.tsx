import { zodResolver } from "@hookform/resolvers/zod";
import { Flag, MessageSquare } from "lucide-react";
import React from "react";
import { useForm } from "react-hook-form";
import type z from "zod";
import { useExperimentDataCommentsCreate } from "~/hooks/experiment/useExperimentDataCommentsCreate/useExperimentDataCommentsCreate";

import { zCreateExperimentDataCommentsBody, zExperimentDataCommentFlag } from "@repo/api";
import type { CreateExperimentDataComments } from "@repo/api";
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

const zAddCommentDialogSchema = zCreateExperimentDataCommentsBody.omit({ rowIds: true });
type AddCommentDialogFormType = z.infer<typeof zAddCommentDialogSchema>;

export interface AddCommentDialogProps {
  experimentId: string;
  tableName: string;
  rowIds: string[];
  type: "comment" | "flag";
  bulk?: boolean;
  bulkOpen?: boolean;
  setBulkOpen?: (value: React.SetStateAction<boolean>) => void;
  clearSelection?: () => void;
}

export function AddCommentDialog({
  experimentId,
  tableName,
  rowIds,
  type,
  bulk,
  bulkOpen,
  setBulkOpen,
  clearSelection,
}: AddCommentDialogProps) {
  const { mutateAsync: createComment } = useExperimentDataCommentsCreate();
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);

  const bulkSuffix = bulk ? "Bulk" : "";
  const count = rowIds.length;

  const form = useForm<AddCommentDialogFormType>({
    resolver: zodResolver(
      type === "flag"
        ? zAddCommentDialogSchema.extend({ flag: zExperimentDataCommentFlag })
        : zAddCommentDialogSchema,
    ),
    defaultValues: {},
  });

  async function onSubmit(formData: AddCommentDialogFormType) {
    const data: CreateExperimentDataComments = {
      rowIds,
      text: formData.text,
      flag: formData.flag,
    };
    await createComment({
      params: { id: experimentId, tableName },
      body: data,
    });
    toast({ description: t("experimentDataComments.updated") });
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
          <Button variant="ghost" size="sm">
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
                {t(`experimentDataComments.${type}Dialog${bulkSuffix}.title`)}
              </DialogTitle>
              <DialogDescription>
                {t(`experimentDataComments.${type}Dialog${bulkSuffix}.description`, { count })}
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
                          {t(`experimentDataComments.${type}Dialog${bulkSuffix}.flagLabel`)}
                        </FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="w-[180px]">
                              <SelectValue
                                placeholder={t(
                                  `experimentDataComments.${type}Dialog${bulkSuffix}.flagPlaceholder`,
                                )}
                              />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectGroup>
                              <SelectItem value="needs_review">
                                {t(`experimentDataComments.flagType.needs_review`)}
                              </SelectItem>
                              <SelectItem value="outlier">
                                {t(`experimentDataComments.flagType.outlier`)}
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
                        {t(`experimentDataComments.${type}Dialog${bulkSuffix}.textLabel`)}
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          value={field.value}
                          onChange={field.onChange}
                          rows={4}
                          placeholder={t(
                            `experimentDataComments.${type}Dialog${bulkSuffix}.textPlaceholder`,
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
                {t(`experimentDataComments.${type}Dialog${bulkSuffix}.add`, { count })}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
