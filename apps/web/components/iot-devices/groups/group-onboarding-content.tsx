"use client";

import { DevicePlanQuestions } from "@/components/iot-devices/device-plan-questions";
import type { PlanQuestionEntry } from "@/components/iot-devices/device-plan-questions";
import { DeviceSelectableExperimentRow } from "@/components/iot-devices/device-selectable-experiment-row";
import { TabBodyHeader } from "@/components/iot-devices/tab-body-header";
import { useIotDeviceGroup } from "@/hooks/iot/useIotDeviceGroup/useIotDeviceGroup";
import { useIotDeviceGroupMembers } from "@/hooks/iot/useIotDeviceGroupMembers/useIotDeviceGroupMembers";
import { useOnboardIotDeviceGroup } from "@/hooks/iot/useOnboardIotDeviceGroup/useOnboardIotDeviceGroup";
import { useLocale } from "@/hooks/useLocale";
import { orpc } from "@/lib/orpc";
import { formatHm } from "@/util/date";
import { resolveDeviceLabel } from "@/util/device-presentation";
import { useQuery } from "@tanstack/react-query";
import { Loader2, RefreshCw, Rocket } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import type {
  IotDeviceGroupMember,
  IotDeviceGroupOnboardRow,
} from "@repo/api/domains/iot/device-group/iot-device-group.schema";
import type { DeviceAnswer } from "@repo/api/domains/iot/iot.schema";
import { listItems } from "@repo/api/shared/listing";
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
import { EmptyState } from "@repo/ui/components/empty-state";
import { Label } from "@repo/ui/components/label";
import { Skeleton } from "@repo/ui/components/skeleton";
import { Switch } from "@repo/ui/components/switch";
import { toast } from "@repo/ui/hooks/use-toast";

import { DeviceRow } from "../device-row";
import { GroupOnboardResults } from "./group-onboard-results";

/** Mirrors the contract's cap on an explicit `deviceIds` selection. */
const MAX_BATCH = 100;

/** Phones pick their experiment in the app; a config would never be consumed. */
function isEligible(member: IotDeviceGroupMember): boolean {
  return member.deviceType !== "mobile" && member.status === "active";
}

export function GroupOnboardingContent() {
  const { t } = useTranslation("iot");
  const params = useParams<{ groupId: string }>();
  const locale = useLocale();
  const groupId = params.groupId;

  const { data: group } = useIotDeviceGroup(groupId);
  const { data: membersData, isLoading: isLoadingMembers } = useIotDeviceGroupMembers(groupId);
  const members = useMemo(() => membersData ?? [], [membersData]);

  const { data: experimentsData } = useQuery(
    orpc.experiments.listExperiments.queryOptions({ input: { filter: "member" } }),
  );
  const experiments = listItems(experimentsData);

  const [experimentIds, setExperimentIds] = useState<string[]>([]);
  const [deselectedIds, setDeselectedIds] = useState<Set<string>>(new Set());
  const [includeWorkbook, setIncludeWorkbook] = useState(true);
  // Held in state, not read from the mutation: a failed retry resets mutation
  // data, and the issued configs must stay available for delivery.
  const [rows, setRows] = useState<IotDeviceGroupOnboardRow[] | null>(null);
  const [issuedAt, setIssuedAt] = useState<Date | null>(null);
  const [answers, setAnswers] = useState<Record<string, DeviceAnswer>>({});

  const onboardGroup = useOnboardIotDeviceGroup();

  const eligible = members.filter(isEligible);
  const selectedIds = eligible
    .map((member) => member.deviceId)
    .filter((deviceId) => !deselectedIds.has(deviceId));
  // The contract rejects an oversized selection outright, so the page has to
  // ask for a smaller one instead of letting the submit die on a generic 400.
  const isOverCap = selectedIds.length > MAX_BATCH;
  // Same grammar as the device tab: with experiments selected the run binds
  // them, without any it re-issues every selected device's current config.
  const isReissueRun = experimentIds.length === 0;

  function labelFor(member: IotDeviceGroupMember): string {
    return resolveDeviceLabel(member, t);
  }
  const labels = new Map(members.map((member) => [member.deviceId, labelFor(member)]));

  const handleExperimentToggle = (experimentId: string, checked: boolean) => {
    setExperimentIds((ids) =>
      checked ? [...ids, experimentId] : ids.filter((id) => id !== experimentId),
    );
  };

  const handleDeviceToggle = (deviceId: string, checked: boolean) => {
    setDeselectedIds((previous) => {
      const next = new Set(previous);
      if (checked) {
        next.delete(deviceId);
      } else {
        next.add(deviceId);
      }
      return next;
    });
  };

  const handleOnboard = () => {
    onboardGroup.mutate(
      { groupId, experimentIds, deviceIds: selectedIds, includeWorkbook, answers },
      {
        onSuccess: (data) => {
          setRows(data.devices);
          setIssuedAt(new Date());
          setAnswers({});
          setBoundExperimentNames(
            experiments
              .filter((experiment) => experimentIds.includes(experiment.id))
              .map((experiment) => experiment.name),
          );
          toast({ title: t("iot.groups.onboarding.onboardSuccess") });
        },
        onError: () => {
          toast({ title: t("iot.onboarding.onboardError"), variant: "destructive" });
        },
      },
    );
  };

  const handleAnswersChange = useCallback((next: Record<string, DeviceAnswer>) => {
    setAnswers(next);
  }, []);

  // Plan questions are experiment-level and answered once, but each device's
  // config carries its own full binding set (a re-issue can differ per member),
  // so the union across every row is collected, deduplicated by question id.
  const questions = useMemo<PlanQuestionEntry[]>(() => {
    const byId = new Map<string, PlanQuestionEntry>();
    for (const row of rows ?? []) {
      for (const experiment of row.config?.experiments ?? []) {
        for (const procedure of experiment.procedures) {
          if (procedure.type === "question" && !byId.has(procedure.id)) {
            byId.set(procedure.id, {
              experimentName: experiment.experimentName,
              question: procedure,
            });
          }
        }
      }
    }
    return [...byId.values()];
  }, [rows]);

  // What the last batch actually bound, for the results narrative; captured at
  // submit so later selection changes don't rewrite history.
  const [boundExperimentNames, setBoundExperimentNames] = useState<string[]>([]);

  const hasUnansweredRequired = questions.some(
    (entry) => entry.question.required && !(answers[entry.question.id] ?? entry.question.answer),
  );

  function renderOnboardIcon() {
    if (onboardGroup.isPending) {
      return <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />;
    }
    if (isReissueRun) {
      return <RefreshCw className="mr-2 h-4 w-4" aria-hidden />;
    }
    return <Rocket className="mr-2 h-4 w-4" aria-hidden />;
  }

  function renderMemberRow(member: IotDeviceGroupMember) {
    const eligibleMember = isEligible(member);
    const ineligibleReason =
      member.deviceType === "mobile"
        ? t("iot.groups.onboarding.mobileIneligible")
        : t("iot.groups.onboarding.inactiveIneligible");

    return (
      <li key={member.deviceId}>
        <DeviceRow
          device={{ ...member, id: member.deviceId }}
          selection={{
            checked: eligibleMember && !deselectedIds.has(member.deviceId),
            disabled: !eligibleMember,
            onCheckedChange: (checked) => {
              handleDeviceToggle(member.deviceId, checked);
            },
          }}
          trailing={
            eligibleMember ? undefined : (
              <span className="flex items-center gap-2">
                <Badge variant="outline" className="text-muted-foreground font-normal">
                  {ineligibleReason}
                </Badge>
                {/* The reason carries the fix: phones need nothing, an inactive
                    device needs its credentials. */}
                {member.deviceType !== "mobile" && (
                  <Link
                    href={`/${locale}/platform/devices/${member.deviceId}/credentials`}
                    className="text-primary text-xs font-medium hover:underline"
                  >
                    {t("iot.devices.nextAction.issueCredentials")}
                  </Link>
                )}
              </span>
            )
          }
        />
      </li>
    );
  }

  if (isLoadingMembers) {
    return (
      <div className="max-w-3xl space-y-4">
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div>
      <TabBodyHeader
        title={t("iot.groups.onboarding.title")}
        description={t("iot.groups.onboarding.description")}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-6">
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="text-base">
                {t("iot.groups.onboarding.experimentsTitle")}
              </CardTitle>
              <CardDescription>{t("iot.groups.onboarding.experimentsDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {experiments.length === 0 ? (
                <EmptyState size="inline" description={t("iot.groups.onboarding.noExperiments")} />
              ) : (
                <ul className="divide-y rounded-lg border">
                  {experiments.map((experiment) => (
                    <DeviceSelectableExperimentRow
                      key={experiment.id}
                      experiment={experiment}
                      isSelected={experimentIds.includes(experiment.id)}
                      onToggle={handleExperimentToggle}
                    />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                {t("iot.groups.onboarding.devicesTitle")}
                <Badge variant="secondary">
                  {t("iot.groups.onboarding.devicesSelected", {
                    selected: selectedIds.length,
                    total: members.length,
                  })}
                </Badge>
              </CardTitle>
              <CardDescription>{t("iot.groups.onboarding.devicesDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {members.length === 0 ? (
                <EmptyState size="inline" description={t("iot.groups.noMembers")} />
              ) : (
                <ul className="divide-y rounded-lg border">{members.map(renderMemberRow)}</ul>
              )}

              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    id="group-include-workbook"
                    checked={includeWorkbook}
                    onCheckedChange={setIncludeWorkbook}
                  />
                  <Label htmlFor="group-include-workbook" className="text-sm font-normal">
                    {t("iot.onboarding.includeWorkbook")}
                  </Label>
                </div>

                {isOverCap && (
                  <p className="text-sm text-amber-600">
                    {t("iot.groups.onboarding.overCap", { max: MAX_BATCH })}
                  </p>
                )}
                <div className="text-right">
                  <Button
                    className="w-fit"
                    onClick={handleOnboard}
                    disabled={selectedIds.length === 0 || isOverCap || onboardGroup.isPending}
                  >
                    {renderOnboardIcon()}
                    {isReissueRun
                      ? t("iot.onboarding.reissue")
                      : t("iot.groups.onboarding.onboard", { count: selectedIds.length })}
                  </Button>
                  {isReissueRun && (
                    <p className="text-muted-foreground mt-1 text-xs">
                      {t("iot.groups.onboarding.reissueHint")}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {rows !== null && questions.length > 0 && (
            <DevicePlanQuestions questions={questions} onAnswersChange={handleAnswersChange} />
          )}
        </div>

        <div className="lg:sticky lg:top-20 lg:self-start">
          <Card className="shadow-none">
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">{t("iot.onboarding.rail.title")}</CardTitle>
              {rows === null ? (
                <Badge variant="outline">{t("iot.onboarding.rail.preview")}</Badge>
              ) : (
                issuedAt !== null && (
                  <Badge variant="secondary">
                    {t("iot.onboarding.rail.issuedAt", { time: formatHm(issuedAt) })}
                  </Badge>
                )
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {/* One configuration per device, all cut from the same selection;
                  the rail summarises the batch rather than one manifest. */}
              <div className="bg-muted/50 space-y-1 rounded-lg p-3">
                <p className="text-sm">
                  {t("iot.onboarding.selectedCount", { count: experimentIds.length })}
                </p>
                <p className="text-sm">
                  {t("iot.groups.onboarding.devicesSelected", {
                    selected: selectedIds.length,
                    total: members.length,
                  })}
                </p>
                <p className="text-muted-foreground text-xs">
                  {includeWorkbook
                    ? t("iot.onboarding.includeWorkbook")
                    : t("iot.onboarding.rail.workbookExcluded")}
                </p>
              </div>

              {rows === null ? (
                <p className="text-muted-foreground text-xs">
                  {t("iot.onboarding.rail.topicsWhenIssued")}
                </p>
              ) : (
                <GroupOnboardResults
                  groupName={group?.name ?? "group"}
                  rows={rows}
                  labelByDeviceId={labels}
                  boundExperimentNames={boundExperimentNames}
                  answers={answers}
                  deliveryBlocked={hasUnansweredRequired}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
