"use client";

import { DocsHelpLink } from "@/components/docs-help-link";
import { DiscardChangesDialog } from "@/components/shared/discard-changes-dialog";
import { useExperimentUpdate } from "@/hooks/experiment/useExperimentUpdate/useExperimentUpdate";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { parseApiError } from "~/util/apiError";

import type { DataLicense, Experiment } from "@repo/api/domains/experiment/experiment.schema";
import { zDataLicense } from "@repo/api/domains/experiment/experiment.schema";
import type { StudyRecord } from "@repo/api/domains/experiment/study/experiment-study.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogBody,
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
import { Input } from "@repo/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { Textarea } from "@repo/ui/components/textarea";
import { toast } from "@repo/ui/hooks/use-toast";

import type { StudyDetailsFormValues } from "./study-details-form-schema";
import { experimentToFormValues, studyDetailsFormSchema } from "./study-details-form-schema";
import { StudyFundingFields } from "./study-funding-fields";
import { StudyRelatedWorkFields } from "./study-related-work-fields";
import { StudySubjectsField } from "./study-subjects-field";

const LICENSE_NONE = "none";

interface ExperimentStudyDetailsDialogProps {
  experimentId: string;
  experiment: Experiment;
  record: StudyRecord | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExperimentStudyDetailsDialog({
  experimentId,
  experiment,
  record,
  open,
  onOpenChange,
}: ExperimentStudyDetailsDialogProps) {
  const { t } = useTranslation("experiments");
  const { t: tStudy } = useTranslation("studyMetadata");
  const { mutateAsync: updateExperiment, isPending } = useExperimentUpdate();

  const form = useForm<StudyDetailsFormValues>({
    resolver: zodResolver(studyDetailsFormSchema),
    defaultValues: experimentToFormValues(experiment, record),
  });

  const isDirty = form.formState.isDirty;
  const [isDiscardOpen, setIsDiscardOpen] = useState(false);

  useEffect(() => {
    if (open) {
      form.reset(experimentToFormValues(experiment, record));
    }
  }, [open, experiment, record, form]);

  const licenseLabels: Record<DataLicense, string> = {
    "CC0-1.0": t("studyDetails.licenseCc0"),
    "CC-BY-4.0": t("studyDetails.licenseCcBy"),
    "CC-BY-SA-4.0": t("studyDetails.licenseCcBySa"),
  };

  const renderLicense = (license: DataLicense) => (
    <SelectItem key={license} value={license}>
      {licenseLabels[license]}
    </SelectItem>
  );

  const handleOptionalChange =
    (onChange: (value: string | null) => void) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange(event.target.value || null);

  const handleOpenChange = (next: boolean) => {
    if (!next && isDirty) {
      setIsDiscardOpen(true);
    } else {
      onOpenChange(next);
    }
  };

  const handleKeepEditing = () => setIsDiscardOpen(false);

  const handleDiscard = () => {
    setIsDiscardOpen(false);
    onOpenChange(false);
  };

  const onSubmit = async (values: StudyDetailsFormValues) => {
    // Every field is sent; an emptied field is null so the stored value clears.
    await updateExperiment(
      { id: experimentId, ...values },
      {
        onSuccess: () => {
          toast({ description: t("experiments.experimentUpdated") });
          onOpenChange(false);
        },
        onError: (err) => {
          toast({ description: parseApiError(err)?.message, variant: "destructive" });
        },
      },
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("studyDetails.title")}</DialogTitle>
            <DialogDescription>{t("studyDetails.dialogDescription")}</DialogDescription>
            <DocsHelpLink
              path="/guide/sharing/open-fair-data"
              label={t("studyDetails.learnMore")}
            />
          </DialogHeader>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="flex min-h-0 flex-1 flex-col gap-4"
            >
              <DialogBody className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("studyDetails.startDate")}</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            value={field.value ?? ""}
                            onChange={handleOptionalChange(field.onChange)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("studyDetails.endDate")}</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            value={field.value ?? ""}
                            onChange={handleOptionalChange(field.onChange)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <StudySubjectsField form={form} />

                <FormField
                  control={form.control}
                  name="experimentalDesign"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("studyDetails.experimentalDesign")}</FormLabel>
                      <FormControl>
                        <Textarea
                          value={field.value ?? ""}
                          onChange={handleOptionalChange(field.onChange)}
                          placeholder={tStudy("design.placeholder")}
                        />
                      </FormControl>
                      <FormDescription>{tStudy("design.help")}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <StudyRelatedWorkFields form={form} />

                <FormField
                  control={form.control}
                  name="license"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("studyDetails.license")}</FormLabel>
                      <Select
                        value={field.value ?? LICENSE_NONE}
                        onValueChange={(value) =>
                          field.onChange(value === LICENSE_NONE ? null : value)
                        }
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t("studyDetails.licensePlaceholder")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={LICENSE_NONE}>
                            {t("studyDetails.licenseNone")}
                          </SelectItem>
                          {zDataLicense.options.map(renderLicense)}
                        </SelectContent>
                      </Select>
                      <FormDescription>{t("studyDetails.licenseHelp")}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <StudyFundingFields form={form} />
              </DialogBody>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit" disabled={isPending}>
                  {t("common.save")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      <DiscardChangesDialog
        open={isDiscardOpen}
        onKeepEditing={handleKeepEditing}
        onDiscard={handleDiscard}
      />
    </>
  );
}
