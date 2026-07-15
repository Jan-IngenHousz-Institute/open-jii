"use client";

import { useDeviceExperiments } from "@/hooks/iot/useDeviceExperiments/useDeviceExperiments";
import { useOnboardDevice } from "@/hooks/iot/useOnboardDevice/useOnboardDevice";
import { tsr } from "@/lib/tsr";
import { FlaskConical, Loader2, Rocket } from "lucide-react";
import { useMemo, useState } from "react";

import type { IotDevice } from "@repo/api/schemas/iot.schema";
import type { DeviceOnboardingConfig } from "@repo/api/schemas/iot.schema";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Checkbox } from "@repo/ui/components/checkbox";
import { Skeleton } from "@repo/ui/components/skeleton";
import { toast } from "@repo/ui/hooks/use-toast";

import { DeviceConfigDelivery } from "./device-config-delivery";

export function DeviceOnboardingPanel({ device }: { device: IotDevice }) {
  const { t } = useTranslation("iot");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [config, setConfig] = useState<DeviceOnboardingConfig | null>(null);

  const { data: boundData, isLoading: isLoadingBound } = useDeviceExperiments(device.id);
  const bound = useMemo(() => boundData?.body ?? [], [boundData]);
  const boundIds = useMemo(() => new Set(bound.map((e) => e.id)), [bound]);

  const { data: experimentsData } = tsr.experiments.listExperiments.useQuery({
    queryData: { query: { filter: "member" } },
    queryKey: ["experiments", "member"],
  });
  const selectable = useMemo(
    () => (experimentsData?.body ?? []).filter((experiment) => !boundIds.has(experiment.id)),
    [experimentsData, boundIds],
  );

  const { mutate: onboard, isPending: isOnboarding } = useOnboardDevice({
    onSuccess: (issuedConfig) => {
      setConfig(issuedConfig);
      setSelectedIds([]);
      toast({ title: t("iot.onboarding.onboardSuccess") });
    },
  });

  const handleToggle = (experimentId: string, checked: boolean) => {
    setSelectedIds((ids) =>
      checked ? [...ids, experimentId] : ids.filter((id) => id !== experimentId),
    );
  };

  const handleOnboard = () => {
    onboard(
      { params: { deviceId: device.id }, body: { experimentIds: selectedIds } },
      {
        onError: () => toast({ title: t("iot.onboarding.onboardError"), variant: "destructive" }),
      },
    );
  };

  const hasBindings = bound.length > 0;
  const hasSelection = selectedIds.length > 0;
  // Re-issuing the config only makes sense once something is bound.
  const canOnboard = (hasSelection || hasBindings) && !isOnboarding;

  return (
    <div className="max-w-3xl space-y-8">
      <section className="space-y-3">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">{t("iot.onboarding.currentTitle")}</h3>
          <p className="text-muted-foreground text-xs">{t("iot.onboarding.currentDescription")}</p>
        </div>

        {isLoadingBound && <Skeleton className="h-14 w-full" />}

        {!isLoadingBound && !hasBindings && (
          <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
            {t("iot.onboarding.currentEmpty")}
          </p>
        )}

        {!isLoadingBound && hasBindings && (
          <ul className="divide-y rounded-lg border">
            {bound.map((experiment) => (
              <li key={experiment.id} className="flex items-center gap-3 px-3 py-2.5">
                <FlaskConical className="text-muted-foreground h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {experiment.name}
                </span>
                <Badge variant="outline" className="shrink-0 capitalize">
                  {experiment.status}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">{t("iot.onboarding.addTitle")}</h3>
          <p className="text-muted-foreground text-xs">{t("iot.onboarding.addDescription")}</p>
        </div>

        {selectable.length === 0 && (
          <p className="text-muted-foreground text-sm">{t("iot.onboarding.addEmpty")}</p>
        )}

        {selectable.length > 0 && (
          <ul className="divide-y rounded-lg border">
            {selectable.map((experiment) => (
              <li key={experiment.id} className="flex items-center gap-3 px-3 py-2.5">
                <Checkbox
                  id={`onboard-${experiment.id}`}
                  checked={selectedIds.includes(experiment.id)}
                  onCheckedChange={(checked) => handleToggle(experiment.id, checked === true)}
                />
                <label
                  htmlFor={`onboard-${experiment.id}`}
                  className="min-w-0 flex-1 cursor-pointer truncate text-sm"
                >
                  {experiment.name}
                </label>
              </li>
            ))}
          </ul>
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
