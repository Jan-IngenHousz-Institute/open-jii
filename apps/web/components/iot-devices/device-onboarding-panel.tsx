"use client";

import { useDeviceExperiments } from "@/hooks/iot/useDeviceExperiments/useDeviceExperiments";
import { useOnboardDevice } from "@/hooks/iot/useOnboardDevice/useOnboardDevice";
import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Rocket } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import type {
  DeviceAnswer,
  DeviceOnboardingConfig,
  IotDevice,
} from "@repo/api/domains/iot/iot.schema";
import { applyPlanAnswers } from "@repo/api/transforms/workbook-device-plan";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { Label } from "@repo/ui/components/label";
import { Skeleton } from "@repo/ui/components/skeleton";
import { Switch } from "@repo/ui/components/switch";
import { toast } from "@repo/ui/hooks/use-toast";

import { DeviceBoundExperimentRow } from "./device-bound-experiment-row";
import { DeviceConfigDelivery } from "./device-config-delivery";
import { DeviceOnboardingGuide } from "./device-onboarding-guide";
import type { PlanQuestionEntry } from "./device-plan-questions";
import { DevicePlanQuestions } from "./device-plan-questions";
import { DeviceSelectableExperimentRow } from "./device-selectable-experiment-row";

export function DeviceOnboardingPanel({ device }: { device: IotDevice }) {
  const { t } = useTranslation("iot");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const {
    data: boundData,
    isLoading: isLoadingBound,
    isError: isBoundError,
  } = useDeviceExperiments(device.id);
  const bound = useMemo(() => boundData ?? [], [boundData]);
  const boundIds = useMemo(() => new Set(bound.map((experiment) => experiment.id)), [bound]);

  const { data: experimentsData, isError: isExperimentsError } = useQuery(
    orpc.experiments.listExperiments.queryOptions({ input: { filter: "member" } }),
  );
  const selectable = useMemo(
    () => (experimentsData ?? []).filter((experiment) => !boundIds.has(experiment.id)),
    [experimentsData, boundIds],
  );

  const { mutate: onboard, isPending: isOnboarding } = useOnboardDevice();
  // Held in state, not read from the mutation: a failed retry resets mutation
  // data, and the previously issued config must stay available for delivery.
  const [config, setConfig] = useState<DeviceOnboardingConfig | null>(null);
  const [includeWorkbook, setIncludeWorkbook] = useState(true);
  const [answers, setAnswers] = useState<Record<string, DeviceAnswer>>({});

  const handleToggle = (experimentId: string, checked: boolean) => {
    setSelectedIds((ids) =>
      checked ? [...ids, experimentId] : ids.filter((id) => id !== experimentId),
    );
  };

  const handleOnboard = () => {
    onboard(
      { deviceId: device.id, experimentIds: selectedIds, includeWorkbook },
      {
        onSuccess: (data) => {
          setConfig(data);
          setSelectedIds([]);
          setAnswers({});
          toast({ title: t("iot.onboarding.onboardSuccess") });
        },
        onError: () => toast({ title: t("iot.onboarding.onboardError"), variant: "destructive" }),
      },
    );
  };

  const handleAnswersChange = useCallback((next: Record<string, DeviceAnswer>) => {
    setAnswers(next);
  }, []);

  const questions = useMemo<PlanQuestionEntry[]>(
    () =>
      (config?.experiments ?? []).flatMap((experiment) =>
        experiment.procedures
          .filter((procedure) => procedure.type === "question")
          .map((question) => ({ experimentName: experiment.experimentName, question })),
      ),
    [config],
  );

  // Answers travel only inside the delivered file; the device attaches them to
  // every measurement, so required ones must be filled before delivery.
  const deliveredConfig = useMemo(
    () => (config ? applyPlanAnswers(config, answers) : null),
    [config, answers],
  );
  const hasUnansweredRequired = questions.some(
    (entry) => entry.question.required && !(answers[entry.question.id] ?? entry.question.answer),
  );

  const renderBoundRow = (experiment: (typeof bound)[number]) => (
    <DeviceBoundExperimentRow key={experiment.id} experiment={experiment} />
  );

  const renderSelectableRow = (experiment: (typeof selectable)[number]) => (
    <DeviceSelectableExperimentRow
      key={experiment.id}
      experiment={experiment}
      isSelected={selectedIds.includes(experiment.id)}
      onToggle={handleToggle}
    />
  );

  // The config only works with live credentials; the backend rejects non-active
  // devices, so the action is disabled up front with an explanation.
  const isDeviceActive = device.status === "active";
  const hasBindings = bound.length > 0;
  const hasSelection = selectedIds.length > 0;
  // Re-issuing the config only makes sense once something is bound.
  const canOnboard = isDeviceActive && (hasSelection || hasBindings) && !isOnboarding;

  return (
    <div className="max-w-3xl space-y-6">
      <DeviceOnboardingGuide />

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            {t("iot.onboarding.currentTitle")}
            {hasBindings && <Badge variant="secondary">{bound.length}</Badge>}
          </CardTitle>
          <CardDescription>{t("iot.onboarding.currentDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingBound && <Skeleton className="h-14 w-full" />}

          {isBoundError && (
            <p className="text-destructive text-sm">{t("iot.onboarding.loadError")}</p>
          )}

          {!isLoadingBound && !isBoundError && !hasBindings && (
            <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
              {t("iot.onboarding.currentEmpty")}
            </p>
          )}

          {!isLoadingBound && !isBoundError && hasBindings && (
            <ul className="divide-y rounded-lg border">{bound.map(renderBoundRow)}</ul>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-base">{t("iot.onboarding.addTitle")}</CardTitle>
          <CardDescription>{t("iot.onboarding.addDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isExperimentsError && (
            <p className="text-destructive text-sm">{t("iot.onboarding.loadError")}</p>
          )}

          {!isExperimentsError && selectable.length === 0 && (
            <p className="text-muted-foreground text-sm">{t("iot.onboarding.addEmpty")}</p>
          )}

          {!isExperimentsError && selectable.length > 0 && (
            <ul className="divide-y rounded-lg border">{selectable.map(renderSelectableRow)}</ul>
          )}

          {!isDeviceActive && (
            <p className="text-muted-foreground text-sm">{t("iot.onboarding.inactiveDevice")}</p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Switch
                id="include-workbook"
                checked={includeWorkbook}
                onCheckedChange={setIncludeWorkbook}
              />
              <Label htmlFor="include-workbook" className="text-sm font-normal">
                {t("iot.onboarding.includeWorkbook")}
              </Label>
            </div>

            <Button className="w-fit" onClick={handleOnboard} disabled={!canOnboard}>
              {isOnboarding ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Rocket className="mr-2 h-4 w-4" />
              )}
              {hasSelection ? t("iot.onboarding.onboard") : t("iot.onboarding.reissue")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {questions.length > 0 && (
        <DevicePlanQuestions questions={questions} onAnswersChange={handleAnswersChange} />
      )}

      {deliveredConfig !== null && (
        <DeviceConfigDelivery
          device={device}
          config={deliveredConfig}
          disabled={hasUnansweredRequired}
          disabledHint={hasUnansweredRequired ? t("iot.onboarding.answerRequiredHint") : null}
        />
      )}
    </div>
  );
}
