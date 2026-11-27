"use client";

import { useLocale } from "@/hooks/useLocale";

import type { DevicePower } from "@repo/api/domains/iot/device-power.schema";
import { hasUsableBattery } from "@repo/api/transforms/ambyte-power";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";

const chargeStateKeys: Record<number, string> = {
  0: "powerNotCharging",
  1: "powerTrickle",
  2: "powerConstantCurrent",
  3: "powerChargeDone",
};

export function PowerPanel({ power }: { power: DevicePower | undefined }) {
  const { t } = useTranslation("iot");
  const locale = useLocale();
  const latest = power?.latest;
  if (!latest) return <p role="status">{t("iot.devices.monitoring.powerUnavailable")}</p>;

  const protection = latest.protection;
  const state = protection?.state;
  const stateKey =
    state === "normal"
      ? "powerNormal"
      : state === "no_flash"
        ? "powerNoFlash"
        : state === "hold"
          ? "powerHold"
          : "powerUnknown";
  const missing = t("iot.devices.monitoring.batteryMissing");
  const date = (value: string) => new Date(value).toLocaleString(locale, { timeZoneName: "short" });
  const since = protection?.sinceUtc;
  const sinceDate =
    since !== null && since !== undefined && since * 1000 >= Date.UTC(2020, 0, 1)
      ? new Date(since * 1000)
      : null;
  const lastBattery = power.lastValidBattery;
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        {t("iot.devices.monitoring.powerCaptured", { at: date(latest.capturedAt) })}
      </p>
      {Date.parse(latest.capturedAt) > Date.now() + 300_000 && (
        <p role="status">{t("iot.devices.monitoring.powerFuture")}</p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <h4 className="text-sm font-medium">{t("iot.devices.monitoring.powerProtection")}</h4>
          <Badge variant="outline" className="my-2">
            {t(`iot.devices.monitoring.${stateKey}`)}
          </Badge>
          {state && !["normal", "no_flash", "hold"].includes(state) && <p>{state}</p>}
          <dl className="space-y-1 text-sm">
            <Row
              label={t("iot.devices.monitoring.powerReason")}
              value={protection?.reason ?? missing}
            />
            <Row
              label={t("iot.devices.monitoring.powerSince")}
              value={
                sinceDate && Number.isFinite(sinceDate.getTime())
                  ? sinceDate.toLocaleString(locale, { timeZoneName: "short" })
                  : missing
              }
            />
            <Row
              label={t("iot.devices.monitoring.powerSkippedFlash")}
              value={String(protection?.skipped.flashRuns ?? missing)}
            />
            <Row
              label={t("iot.devices.monitoring.powerSkippedAmbit")}
              value={String(protection?.skipped.ambitRuns ?? missing)}
            />
            <Row
              label={t("iot.devices.monitoring.powerSkippedOta")}
              value={String(protection?.skipped.ota ?? missing)}
            />
          </dl>
        </div>
        <dl className="space-y-2 text-sm">
          <Row
            label={t("iot.devices.monitoring.powerVbat")}
            value={hasUsableBattery(latest) ? `${latest.batteryV?.toFixed(2)} V` : missing}
          />
          <Row
            label={t("iot.devices.monitoring.powerVsys")}
            value={
              latest.valid === true && latest.systemV !== null && latest.systemV > 0
                ? `${latest.systemV.toFixed(2)} V`
                : missing
            }
          />
          <Row
            label={t("iot.devices.monitoring.powerReadingReason")}
            value={latest.reason ?? missing}
          />
          <Row
            label={t("iot.devices.monitoring.powerChargeState")}
            value={
              latest.valid === true && latest.chargeStatus !== null
                ? t(
                    `iot.devices.monitoring.${chargeStateKeys[latest.chargeStatus] ?? "powerUnknown"}`,
                  )
                : missing
            }
          />
          <Row
            label={t("iot.devices.monitoring.powerChargeCurrent")}
            value={
              latest.valid === true && latest.chargeMa !== null ? `${latest.chargeMa} mA` : missing
            }
          />
          <Row
            label={t("iot.devices.monitoring.powerLastBattery")}
            value={
              lastBattery
                ? `${lastBattery.batteryV.toFixed(2)} V · ${date(lastBattery.capturedAt)}`
                : missing
            }
          />
        </dl>
      </div>
      <p className="text-muted-foreground text-xs">{t("iot.devices.monitoring.powerCaveat")}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap justify-between gap-x-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
