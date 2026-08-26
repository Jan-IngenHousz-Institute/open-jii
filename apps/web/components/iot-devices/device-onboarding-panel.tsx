"use client";

import { DeviceExperimentRow } from "@/components/iot-devices/device-experiment-row";
import type { DeviceExperimentRowItem } from "@/components/iot-devices/device-experiment-row";
import { DevicePlanQuestions } from "@/components/iot-devices/device-plan-questions";
import type { PlanQuestionEntry } from "@/components/iot-devices/device-plan-questions";
import { TabBodyHeader } from "@/components/iot-devices/tab-body-header";
import { useExperimentDeviceRemove } from "@/hooks/experiment/useExperimentDeviceRemove/useExperimentDeviceRemove";
import { useDeviceExperiments } from "@/hooks/iot/useDeviceExperiments/useDeviceExperiments";
import { useOnboardDevice } from "@/hooks/iot/useOnboardDevice/useOnboardDevice";
import { useLocale } from "@/hooks/useLocale";
import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Loader2, MoreHorizontal, RefreshCw, Rocket, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  DeviceAnswer,
  DeviceOnboardingConfig,
  IotDevice,
} from "@repo/api/domains/iot/iot.schema";
import { listItems } from "@repo/api/shared/listing";
import { applyPlanAnswers } from "@repo/api/transforms/workbook-device-plan";
import { useTranslation } from "@repo/i18n";
import { Alert, AlertDescription } from "@repo/ui/components/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@repo/ui/components/alert-dialog";
import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { EmptyState } from "@repo/ui/components/empty-state";
import { Label } from "@repo/ui/components/label";
import { ScrollArea } from "@repo/ui/components/scroll-area";
import { SearchInput } from "@repo/ui/components/search-input";
import { Skeleton } from "@repo/ui/components/skeleton";
import { Switch } from "@repo/ui/components/switch";
import { toast } from "@repo/ui/hooks/use-toast";

import { DeviceConfigurationRail } from "./device-configuration-rail";
import type { RailState } from "./device-configuration-rail";

/**
 * The onboarding tab as a two-zone command surface.
 *
 * Left: the choices. Right: the Configuration rail, the manifest of what the
 * device will receive, present from first paint as a preview and resolving in
 * place at issuance. The configuration used to be an invisible payload that
 * appeared below the fold only after a successful mutation.
 */
export function DeviceOnboardingPanel({ device }: { device: IotDevice }) {
  const { t } = useTranslation("iot");
  const { t: tCommon } = useTranslation("common");
  const locale = useLocale();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [experimentFilter, setExperimentFilter] = useState("");
  const [includeWorkbook, setIncludeWorkbook] = useState(true);
  const [answers, setAnswers] = useState<Record<string, DeviceAnswer>>({});
  // Held in state, not read from the mutation: a failed retry resets mutation
  // data, and the previously issued config must stay available for delivery.
  const [config, setConfig] = useState<DeviceOnboardingConfig | null>(null);
  const [issuedAt, setIssuedAt] = useState<Date | null>(null);
  const [isStale, setIsStale] = useState(false);

  const {
    data: boundData,
    isLoading: isLoadingBound,
    isError: isBoundError,
    refetch: refetchBound,
  } = useDeviceExperiments(device.id);
  const bound = useMemo(() => boundData ?? [], [boundData]);
  const boundIds = useMemo(() => new Set(bound.map((experiment) => experiment.id)), [bound]);

  const {
    data: experimentsData,
    isError: isExperimentsError,
    refetch: refetchExperiments,
  } = useQuery(orpc.experiments.listExperiments.queryOptions({ input: { filter: "member" } }));
  const selectable = useMemo(
    () => listItems(experimentsData).filter((experiment) => !boundIds.has(experiment.id)),
    [experimentsData, boundIds],
  );

  const { mutate: onboard, isPending: isOnboarding } = useOnboardDevice();

  const [removing, setRemoving] = useState<{ id: string; name: string } | null>(null);
  const { mutate: removeBinding, isPending: isRemoving } = useExperimentDeviceRemove({
    onSuccess: () => {
      toast({ title: t("iot.onboarding.removeSuccess") });
    },
  });

  const confirmRemove = () => {
    if (removing === null) {
      return;
    }
    removeBinding(
      { id: removing.id, deviceId: device.id },
      {
        onError: () => {
          toast({ title: t("iot.onboarding.removeError"), variant: "destructive" });
        },
        onSettled: () => {
          setRemoving(null);
        },
      },
    );
  };

  // One list, one grammar: bound rows are locked facts, the rest are choices.
  const rows: DeviceExperimentRowItem[] = useMemo(
    () => [
      ...bound.map((experiment) => ({ ...experiment, bound: true })),
      ...selectable.map((experiment) => ({ ...experiment, bound: false })),
    ],
    [bound, selectable],
  );

  // Search and a scroll cap appear only once the list is long enough to need
  // them; a filter over four rows is chrome.
  const isLongList = rows.length > 8;
  const visibleRows = useMemo(() => {
    const query = experimentFilter.trim().toLowerCase();
    if (query === "") {
      return rows;
    }
    return rows.filter((experiment) => experiment.name.toLowerCase().includes(query));
  }, [rows, experimentFilter]);

  const questions = useMemo<PlanQuestionEntry[]>(
    () =>
      (config?.experiments ?? []).flatMap((experiment) =>
        experiment.procedures.flatMap((procedure) =>
          procedure.type === "question"
            ? [{ experimentName: experiment.experimentName, question: procedure }]
            : [],
        ),
      ),
    [config],
  );

  const requiredQuestions = questions.filter((entry) => entry.question.required);
  const missingAnswers = requiredQuestions
    .filter((entry) => !(answers[entry.question.id] ?? entry.question.answer))
    .map((entry) => entry.question.name);
  const answeredRequired = requiredQuestions.length - missingAnswers.length;

  const deliveredConfig = useMemo(
    () => (config ? applyPlanAnswers(config, answers) : null),
    [config, answers],
  );

  const isDeviceActive = device.status === "active";
  const hasBindings = bound.length > 0;
  const hasSelection = selectedIds.length > 0;
  // One button, two jobs: with a selection it onboards, without one it
  // re-issues for everything currently bound.
  const isReissueMode = !hasSelection && hasBindings;
  const canIssue = isDeviceActive && (hasSelection || hasBindings) && !isOnboarding;

  const railState: RailState = isOnboarding
    ? "updating"
    : isStale
      ? "stale"
      : config !== null
        ? "issued"
        : "preview";

  const previewExperiments = useMemo(
    () => [
      ...bound.map((experiment) => ({ id: experiment.id, name: experiment.name, isNew: false })),
      ...selectable
        .filter((experiment) => selectedIds.includes(experiment.id))
        .map((experiment) => ({ id: experiment.id, name: experiment.name, isNew: true })),
    ],
    [bound, selectable, selectedIds],
  );

  // An issuance can surface required questions in the left column while the
  // user's attention is on the rail's Re-issue button; bring them into view
  // once they exist, or they gate delivery invisibly below the fold.
  const questionsAnchorRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (config !== null && questions.length > 0) {
      questionsAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [config, questions.length]);

  const scrollToRail = () => {
    document.getElementById("device-configuration-rail")?.scrollIntoView({ behavior: "smooth" });
  };

  const handleToggle = (experimentId: string, checked: boolean) => {
    setSelectedIds((ids) =>
      checked ? [...ids, experimentId] : ids.filter((id) => id !== experimentId),
    );
  };

  const handleAnswersChange = useCallback((next: Record<string, DeviceAnswer>) => {
    setAnswers(next);
  }, []);

  const issue = (experimentIds: string[]) => {
    onboard(
      { deviceId: device.id, experimentIds, includeWorkbook, answers },
      {
        onSuccess: (data) => {
          setConfig(data);
          setIssuedAt(new Date());
          setIsStale(false);
          setSelectedIds([]);
          setAnswers({});
        },
        // The previous configuration stays on screen, labelled stale, rather
        // than vanishing and leaving the user with nothing to deliver.
        onError: () => {
          setIsStale(config !== null);
          toast({ title: t("iot.onboarding.onboardError"), variant: "destructive" });
        },
      },
    );
  };

  function issueLabel(): string {
    if (hasSelection) {
      return t("iot.onboarding.onboardCount", { count: selectedIds.length });
    }
    if (isReissueMode) {
      return t("iot.onboarding.reissue");
    }
    return t("iot.onboarding.onboard");
  }

  function renderIssueIcon() {
    if (isOnboarding) {
      return <Loader2 className="mr-1.5 size-4 animate-spin" />;
    }
    if (isReissueMode) {
      return <RefreshCw className="mr-1.5 size-4" />;
    }
    return <Rocket className="mr-1.5 size-4" />;
  }

  function renderIssueHelper() {
    if (!isDeviceActive || hasSelection) {
      return null;
    }
    return (
      <p className="text-muted-foreground mt-1 text-xs">
        {isReissueMode ? t("iot.onboarding.reissueHint") : t("iot.onboarding.selectAtLeastOne")}
      </p>
    );
  }

  function renderBlockedNotice() {
    if (isDeviceActive) {
      return null;
    }
    return (
      <Alert>
        <AlertTriangle className="size-4" aria-hidden />
        <AlertDescription>
          {t("iot.onboarding.inactiveDevice")}{" "}
          <Link
            href={`/${locale}/platform/devices/${device.id}/credentials`}
            className="text-primary underline underline-offset-4"
          >
            {t("iot.onboarding.inactiveDeviceAction")}
          </Link>
        </AlertDescription>
      </Alert>
    );
  }

  function renderBoundRowMenu(experiment: DeviceExperimentRowItem) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={t("iot.onboarding.boundRowActions")}
            className="text-muted-foreground hover:bg-muted hover:text-foreground data-[state=open]:bg-muted inline-flex size-8 items-center justify-center rounded-md"
          >
            <MoreHorizontal className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() => {
              setRemoving({ id: experiment.id, name: experiment.name });
            }}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 size-4" />
            {t("iot.onboarding.removeMenuItem")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  function renderRow(experiment: DeviceExperimentRowItem) {
    return (
      <DeviceExperimentRow
        key={experiment.id}
        experiment={experiment}
        selected={selectedIds.includes(experiment.id)}
        onToggle={handleToggle}
        trailing={experiment.bound ? renderBoundRowMenu(experiment) : undefined}
      />
    );
  }

  function renderExperimentList() {
    if (isLoadingBound) {
      return (
        <div className="space-y-2 rounded-lg border p-3">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-5 w-3/5" />
        </div>
      );
    }
    if (isBoundError || isExperimentsError) {
      return (
        <EmptyState
          size="inline"
          variant="error"
          description={t("iot.onboarding.loadError")}
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void refetchBound();
                void refetchExperiments();
              }}
            >
              {t("iot.onboarding.retry")}
            </Button>
          }
        />
      );
    }
    if (rows.length === 0) {
      return <EmptyState size="inline" description={t("iot.onboarding.noMemberships")} />;
    }

    if (visibleRows.length === 0) {
      return <EmptyState size="inline" description={t("iot.onboarding.filterNoMatches")} />;
    }

    const list = <ul className="divide-y rounded-lg border">{visibleRows.map(renderRow)}</ul>;

    return (
      <>
        {isLongList ? <ScrollArea className="max-h-96 overflow-y-auto">{list}</ScrollArea> : list}
        {selectable.length === 0 && hasBindings && (
          <p className="text-muted-foreground text-xs">{t("iot.onboarding.allOnboarded")}</p>
        )}
      </>
    );
  }

  return (
    <div>
      <TabBodyHeader
        title={t("iot.onboarding.title")}
        description={t("iot.onboarding.description")}
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-6">
          <Card className="shadow-none">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-base">{t("iot.onboarding.experimentsTitle")}</CardTitle>
                {isLongList && (
                  <SearchInput
                    value={experimentFilter}
                    onChange={setExperimentFilter}
                    placeholder={t("iot.onboarding.filterExperiments")}
                    className="h-8 w-56"
                  />
                )}
              </div>
              <CardDescription>{t("iot.onboarding.experimentsDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {renderExperimentList()}

              <div className="flex flex-wrap items-center justify-between gap-4 border-t pt-4">
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
                <div className="text-right">
                  <Button
                    onClick={() => {
                      issue(selectedIds);
                    }}
                    disabled={!canIssue}
                  >
                    {renderIssueIcon()}
                    {issueLabel()}
                  </Button>
                  {/* The reason sits under the control it disables, not three blocks away. */}
                  {renderIssueHelper()}
                </div>
              </div>
            </CardContent>
          </Card>

          {renderBlockedNotice()}

          <div ref={questionsAnchorRef} className="scroll-mt-6">
            {questions.length > 0 && (
              <DevicePlanQuestions questions={questions} onAnswersChange={handleAnswersChange} />
            )}
          </div>
        </div>

        <AlertDialog
          open={removing !== null}
          onOpenChange={(open) => {
            if (!open && !isRemoving) {
              setRemoving(null);
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t("iot.onboarding.removeTitle", { name: removing?.name ?? "" })}
              </AlertDialogTitle>
              <AlertDialogDescription>{t("iot.onboarding.removeBody")}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isRemoving}>
                {tCommon("common.cancel")}
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={isRemoving}
                onClick={(e) => {
                  e.preventDefault();
                  confirmRemove();
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isRemoving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  t("iot.onboarding.removeMenuItem")
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <div className="lg:sticky lg:top-20 lg:self-start">
          <DeviceConfigurationRail
            device={device}
            state={railState}
            config={deliveredConfig}
            issuedAt={issuedAt}
            previewExperiments={previewExperiments}
            includeWorkbook={includeWorkbook}
            answered={answeredRequired}
            requiredCount={requiredQuestions.length}
            missingAnswers={missingAnswers}
            blockedNotice={renderBlockedNotice()}
          />
        </div>
      </div>

      {config !== null && (
        <div className="sticky bottom-6 z-10 flex justify-center lg:hidden">
          <Button
            variant="outline"
            className="bg-card/90 rounded-full shadow-lg backdrop-blur-sm"
            onClick={scrollToRail}
          >
            <span className="bg-primary mr-2 size-2 rounded-full" aria-hidden />
            {t("iot.onboarding.rail.title")}
          </Button>
        </div>
      )}
    </div>
  );
}
