"use client";

import type { CreateExperimentBody } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import {
  WizardStepButtons,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  RichTextRenderer,
} from "@repo/ui/components";
import type { WizardStepProps } from "@repo/ui/components";

import { embargoUntilHelperString } from "../embargo-utils";

export function ReviewStep({
  form,
  onPrevious,
  onNext,
  goToStep,
  stepIndex,
  totalSteps,
  isSubmitting = false,
}: WizardStepProps<CreateExperimentBody>) {
  const formData = form.getValues();
  const { t } = useTranslation();

  const embargoPublicDate = embargoUntilHelperString(formData.embargoUntil, t);

  return (
    <div className="mx-auto space-y-8">
      {/* Header Section */}
      <div className="space-y-2">
        <h2 className="text-lg font-medium tracking-tight">
          {t("experiments.reviewYourExperiment")}
        </h2>
        <p className="text-muted-foreground text-sm">{t("experiments.reviewAllDetails")}</p>
      </div>

      <div className="grid gap-6">
        {/* Details */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">
                {t("experiments.detailsTitle")}
              </CardTitle>
              <button
                type="button"
                onClick={() => {
                  (goToStep as (index: number) => void)(0);
                }}
                className="text-muted-foreground text-xs transition-colors"
              >
                {t("common.edit")}
              </button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              <div>
                <div className="text-muted-foreground mb-1 text-xs font-medium uppercase tracking-wider">
                  {t("experiments.experimentName")}
                </div>
                <div className="text-base font-medium">{formData.name || "—"}</div>
              </div>

              {formData.description && (
                <div>
                  <div className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wider">
                    {t("experiments.descriptionTitle")}
                  </div>
                  <div className="rounded-md border p-3 text-sm">
                    <RichTextRenderer content={formData.description} />
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Members & Visibility */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">
                {t("experiments.membersAndVisibility")}
              </CardTitle>
              <button
                type="button"
                onClick={() => {
                  (goToStep as (index: number) => void)(1);
                }}
                className="text-muted-foreground text-xs transition-colors"
              >
                {t("common.edit")}
              </button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3">
              <div>
                <div className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wider">
                  {t("experimentSettings.visibility")}
                </div>
                <Badge variant="outline" className="px-3 py-1 font-medium capitalize">
                  {formData.visibility ?? "public"}
                </Badge>
              </div>

              {formData.visibility !== "public" && formData.embargoUntil && embargoPublicDate && (
                <div className="bg-highlight/20 border-highlight rounded-md border p-3">
                  <div className="mb-1 text-xs font-medium uppercase tracking-wider">
                    {t("experiments.embargo")}
                  </div>
                  <div className="text-sm font-medium">{embargoPublicDate}</div>
                </div>
              )}

              <div>
                <div className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wider">
                  {t("experiments.teamMembers")} ({formData.members?.length ?? 0})
                </div>
                {formData.members?.length ? (
                  <div className="grid gap-2">
                    {formData.members.map((m, i) => (
                      <div
                        key={m.userId || i}
                        className="flex items-center gap-2 rounded-md border px-3 py-2"
                      >
                        <div className="bg-primary/10 flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium">
                          {(m.firstName?.[0] ?? m.lastName?.[0] ?? "U").toUpperCase()}
                        </div>
                        <div className="text-sm font-medium">
                          {m.firstName || m.lastName
                            ? `${m.firstName ?? ""} ${m.lastName ?? ""}`.trim()
                            : t("experiments.unnamedMember")}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-muted-foreground text-sm italic">
                    {t("experiments.noMembersAdded")}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Protocols & Locations Grid */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Protocols */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">
                  {t("experiments.protocolsTitle")}
                </CardTitle>
                <button
                  type="button"
                  onClick={() => {
                    (goToStep as (index: number) => void)(2);
                  }}
                  className="text-muted-foreground text-xs transition-colors"
                >
                  {t("common.edit")}
                </button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wider">
                {t("experiments.selectedProtocols")} ({formData.protocols?.length ?? 0})
              </div>
              {formData.protocols?.length ? (
                <div className="space-y-2">
                  {formData.protocols.map((p, i) => (
                    <div
                      key={p.protocolId || i}
                      className="rounded-md border px-3 py-2 text-sm font-medium"
                    >
                      {p.name ?? t("experiments.unnamedProtocol")}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-muted-foreground text-sm italic">
                  {t("experiments.noProtocolsAdded")}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Locations */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">
                  {t("experiments.locationsTitle")}
                </CardTitle>
                <button
                  type="button"
                  onClick={() => {
                    (goToStep as (index: number) => void)(3);
                  }}
                  className="text-muted-foreground text-xs transition-colors"
                >
                  {t("common.edit")}
                </button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wider">
                {t("experiments.researchLocations")} ({formData.locations?.length ?? 0})
              </div>
              {formData.locations?.length ? (
                <div className="space-y-2">
                  {formData.locations.map((loc, i) => (
                    <div key={i} className="rounded-md border px-3 py-2 text-sm font-medium">
                      {loc.name}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-muted-foreground text-sm italic">
                  {t("experiments.noLocationsAdded")}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <WizardStepButtons
        onPrevious={onPrevious}
        onNext={onNext}
        stepIndex={stepIndex}
        totalSteps={totalSteps}
        isSubmitting={isSubmitting}
        previousLabel={t("experiments.back")}
        submitLabel={t("experiments.createExperiment")}
      />
    </div>
  );
}
