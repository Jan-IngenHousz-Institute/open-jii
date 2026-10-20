"use client";

import { useExperimentUpdate } from "@/hooks/experiment/useExperimentUpdate/useExperimentUpdate";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { useEffect } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { parseApiError } from "~/util/apiError";

import type { DataLicense, Experiment } from "@repo/api/domains/experiment/experiment.schema";
import {
  validateStudyDates,
  zDataLicense,
  zFundingReferenceList,
} from "@repo/api/domains/experiment/experiment.schema";
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

// Cleared fields hold null, not undefined: react-hook-form treats an undefined
// onChange value as "revert to the default", which un-clears the field.
const studyDetailsFormSchema = z
  .object({
    startDate: z.string().date().nullable(),
    endDate: z.string().date().nullable(),
    organism: z.string().trim().max(255).nullable(),
    experimentalDesign: z.string().nullable(),
    growthFacility: z.string().nullable(),
    license: zDataLicense.nullable(),
    fundingReferences: zFundingReferenceList,
  })
  .superRefine((val, ctx) => {
    validateStudyDates(val.startDate, val.endDate, ctx);
  });

type StudyDetailsFormValues = z.infer<typeof studyDetailsFormSchema>;

const LICENSE_NONE = "none";

const experimentToFormValues = (experiment: Experiment): StudyDetailsFormValues => ({
  startDate: experiment.startDate,
  endDate: experiment.endDate,
  organism: experiment.organism,
  experimentalDesign: experiment.experimentalDesign,
  growthFacility: experiment.growthFacility,
  license: experiment.license,
  fundingReferences: experiment.fundingReferences ?? [],
});

interface ExperimentStudyDetailsDialogProps {
  experimentId: string;
  experiment: Experiment;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExperimentStudyDetailsDialog({
  experimentId,
  experiment,
  open,
  onOpenChange,
}: ExperimentStudyDetailsDialogProps) {
  const { t } = useTranslation("experiments");
  const { t: tStudy } = useTranslation("studyMetadata");
  const { mutateAsync: updateExperiment, isPending } = useExperimentUpdate();

  const form = useForm<StudyDetailsFormValues>({
    resolver: zodResolver(studyDetailsFormSchema),
    defaultValues: experimentToFormValues(experiment),
  });

  const funding = useFieldArray({ control: form.control, name: "fundingReferences" });
  const hasFunding = funding.fields.length > 0;

  useEffect(() => {
    if (open) {
      form.reset(experimentToFormValues(experiment));
    }
  }, [open, experiment, form]);

  const licenseLabels: Record<DataLicense, string> = {
    "CC0-1.0": t("studyDetails.licenseCc0"),
    "CC-BY-4.0": t("studyDetails.licenseCcBy"),
  };

  const handleOptionalChange =
    (onChange: (value: string | null) => void) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange(event.target.value || null);

  const handleAddFunding = () => funding.append({ funderName: "", awardNumber: null });

  const renderFundingRow = (row: { id: string }, index: number) => (
    <div key={row.id} className="flex items-start gap-2">
      <FormField
        control={form.control}
        name={`fundingReferences.${index}.funderName`}
        render={({ field }) => (
          <FormItem className="flex-1">
            <FormLabel>{tStudy("funding.funder")}</FormLabel>
            <FormControl>
              <Input {...field} placeholder={tStudy("funding.funderPlaceholder")} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name={`fundingReferences.${index}.awardNumber`}
        render={({ field }) => (
          <FormItem className="flex-1">
            <FormLabel>{tStudy("funding.awardNumber")}</FormLabel>
            <FormControl>
              <Input
                value={field.value ?? ""}
                onChange={handleOptionalChange(field.onChange)}
                placeholder={tStudy("funding.awardNumberPlaceholder")}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="mt-[22px] shrink-0"
        aria-label={tStudy("funding.remove")}
        onClick={() => funding.remove(index)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );

  const onSubmit = async (values: StudyDetailsFormValues) => {
    // Every field is sent; an emptied field is null so the stored value clears.
    await updateExperiment(
      {
        id: experimentId,
        ...values,
      },
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("studyDetails.title")}</DialogTitle>
          <DialogDescription>{t("studyDetails.dialogDescription")}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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

            <FormField
              control={form.control}
              name="organism"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("studyDetails.organism")}</FormLabel>
                  <FormControl>
                    <Input
                      value={field.value ?? ""}
                      onChange={handleOptionalChange(field.onChange)}
                      placeholder={t("studyDetails.organismPlaceholder")}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                      placeholder={t("studyDetails.experimentalDesignPlaceholder")}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="growthFacility"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("studyDetails.growthFacility")}</FormLabel>
                  <FormControl>
                    <Textarea
                      value={field.value ?? ""}
                      onChange={handleOptionalChange(field.onChange)}
                      placeholder={t("studyDetails.growthFacilityPlaceholder")}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="license"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("studyDetails.license")}</FormLabel>
                  <Select
                    value={field.value ?? LICENSE_NONE}
                    onValueChange={(value) => field.onChange(value === LICENSE_NONE ? null : value)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t("studyDetails.licensePlaceholder")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={LICENSE_NONE}>{t("studyDetails.licenseNone")}</SelectItem>
                      {zDataLicense.options.map((license) => (
                        <SelectItem key={license} value={license}>
                          {licenseLabels[license]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <section aria-labelledby="study-details-funding" className="space-y-3 border-t pt-4">
              <h3 id="study-details-funding" className="text-sm font-semibold">
                {tStudy("funding.title")}
              </h3>
              {hasFunding ? (
                funding.fields.map(renderFundingRow)
              ) : (
                <p className="text-muted-foreground text-sm">{tStudy("funding.empty")}</p>
              )}
              <Button type="button" variant="outline" size="sm" onClick={handleAddFunding}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                {hasFunding ? tStudy("funding.addAnother") : tStudy("funding.add")}
              </Button>
            </section>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
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
  );
}
