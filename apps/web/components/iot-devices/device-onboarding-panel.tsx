"use client";

import { useDeviceExperiments } from "@/hooks/iot/useDeviceExperiments/useDeviceExperiments";
import { useOnboardDevice } from "@/hooks/iot/useOnboardDevice/useOnboardDevice";
import { tsr } from "@/lib/tsr";
import { Loader2, Rocket } from "lucide-react";
import { useMemo, useState } from "react";

import type { IotDevice } from "@repo/api/schemas/iot.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Skeleton } from "@repo/ui/components/skeleton";
import { toast } from "@repo/ui/hooks/use-toast";

import { DeviceBoundExperimentRow } from "./device-bound-experiment-row";
import { DeviceConfigDelivery } from "./device-config-delivery";
import { DeviceSelectableExperimentRow } from "./device-selectable-experiment-row";

export function DeviceOnboardingPanel({ device }: { device: IotDevice }) {
  const { t } = useTranslation("iot");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const {
    data: boundData,
    isLoading: isLoadingBound,
    isError: isBoundError,
  } = useDeviceExperiments(device.id);
  const bound = useMemo(() => boundData?.body ?? [], [boundData]);
  const boundIds = useMemo(() => new Set(bound.map((experiment) => experiment.id)), [bound]);

  const { data: experimentsData, isError: isExperimentsError } =
    tsr.experiments.listExperiments.useQuery({
      queryData: { query: { filter: "member" } },
      // Mirrors useExperiments' key shape (filter, status, search, archived) so
      // prefix and exact-match invalidations both cover this cache.
      queryKey: ["experiments", "member", undefined, "", false],
    });
  const selectable = useMemo(
    () => (experimentsData?.body ?? []).filter((experiment) => !boundIds.has(experiment.id)),
    [experimentsData, boundIds],
  );

  const { mutate: onboard, isPending: isOnboarding, data: onboardData } = useOnboardDevice();
  const config = onboardData?.body ?? null;

  const handleToggle = (experimentId: string, checked: boolean) => {
    setSelectedIds((ids) =>
      checked ? [...ids, experimentId] : ids.filter((id) => id !== experimentId),
    );
  };

  const handleOnboard = () => {
    onboard(
      { params: { deviceId: device.id }, body: { experimentIds: selectedIds } },
      {
        onSuccess: () => {
          setSelectedIds([]);
          toast({ title: t("iot.onboarding.onboardSuccess") });
        },
        onError: () => toast({ title: t("iot.onboarding.onboardError"), variant: "destructive" }),
      },
    );
  };

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
    <div className="max-w-3xl space-y-8">
      <section className="space-y-3">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">{t("iot.onboarding.currentTitle")}</h3>
          <p className="text-muted-foreground text-xs">{t("iot.onboarding.currentDescription")}</p>
        </div>

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
      </section>

      <section className="space-y-3">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">{t("iot.onboarding.addTitle")}</h3>
          <p className="text-muted-foreground text-xs">{t("iot.onboarding.addDescription")}</p>
        </div>

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

        <Button onClick={handleOnboard} disabled={!canOnboard}>
          {isOnboarding ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Rocket className="mr-2 h-4 w-4" />
          )}
          {hasSelection ? t("iot.onboarding.onboard") : t("iot.onboarding.reissue")}
        </Button>
      </section>

      {config !== null && <DeviceConfigDelivery device={device} config={config} />}
    </div>
  );
}
