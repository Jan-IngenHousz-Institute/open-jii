"use client";

import { OwningOrganizationField } from "@/components/organizations/owning-organization-field";
import { PublishConfirmDialog } from "@/components/visibility/publish-confirm-dialog";
import { WorkbookDeleteAction } from "@/components/workbook-overview/workbook-delete-action";
import { WorkbookVersionBadge } from "@/components/workbook/workbook-version-badge";
import { useLocale } from "@/hooks/useLocale";
import { useSetWorkbookVisibility } from "@/hooks/workbook/useSetWorkbookVisibility/useSetWorkbookVisibility";
import { useWorkbookCreate } from "@/hooks/workbook/useWorkbookCreate/useWorkbookCreate";
import { useWorkbookVersions } from "@/hooks/workbook/useWorkbookVersions/useWorkbookVersions";
import { formatDate } from "@/util/date";
import { GitFork, Globe, Info, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { parseApiError } from "~/util/apiError";

import type { WorkbookDetail } from "@repo/api/domains/workbook/workbook.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Skeleton } from "@repo/ui/components/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/components/tooltip";
import { toast } from "@repo/ui/hooks/use-toast";

interface WorkbookMetaRowProps {
  id: string;
  workbook: WorkbookDetail;
}

/**
 * Keeping provenance and its version fetch on Overview avoids work on the
 * Collaborators route. Visibility stays a field like the other provenance; its
 * only mutation is irreversible publish, so that remains a separate action.
 */
export function WorkbookMetaRow({ id, workbook }: WorkbookMetaRowProps) {
  const { t } = useTranslation(["workbook", "common"]);
  const { t: tCommon } = useTranslation("common");
  const {
    data: versionsData,
    isLoading: isLoadingVersions,
    isError: isVersionsError,
  } = useWorkbookVersions(id);
  const router = useRouter();
  const locale = useLocale();
  const { mutate: createWorkbook, isPending: isForking } = useWorkbookCreate({
    onSuccess: (created) => router.push(`/${locale}/platform/workbooks/${created.id}`),
  });

  const handleFork = () => {
    createWorkbook({
      name: t("workbooks.duplicateName", { name: workbook.name }),
      description: workbook.description ?? undefined,
      cells: workbook.cells,
      metadata: workbook.metadata,
      forkedFrom: workbook.id,
    });
  };

  const [showPublishConfirm, setShowPublishConfirm] = useState(false);
  // Show the published state immediately on confirm, before the refetch lands.
  // Visibility is monotonic, so OR-ing with the prop is safe.
  const [publishedLocally, setPublishedLocally] = useState(false);
  const { mutateAsync: setVisibility, isPending: isPublishing } = useSetWorkbookVisibility();
  const isPublic = workbook.visibility === "public" || publishedLocally;

  const publishHelpText = isPublic
    ? tCommon("resourceVisibility.publishedDescription")
    : tCommon("resourceVisibility.privateDescription");

  const handlePublish = async () => {
    try {
      await setVisibility({ id, visibility: "public" });
      setPublishedLocally(true);
      setShowPublishConfirm(false);
      toast({ description: tCommon("resourceVisibility.publishedToast") });
    } catch (err) {
      toast({
        description: parseApiError(err)?.message ?? tCommon("resourceVisibility.publishFailed"),
        variant: "destructive",
      });
    }
  };

  // Versions are returned newest-first; the live page is the draft, so the
  // latest published version is the meaningful number to surface here.
  const latestVersion = versionsData?.[0]?.version;
  // Capability, not ownership: a "Can edit" grantee renames and edits.
  const { canManage, canTransfer } = workbook.capabilities;

  return (
    <div className="border-border flex flex-wrap items-start gap-x-6 gap-y-6 border-b pb-8 sm:gap-x-10">
      <div className="flex flex-col gap-1">
        <span className="text-foreground text-sm font-medium leading-[18px] tracking-[0.02em]">
          {tCommon("common.created")}
        </span>
        <span className="text-muted-foreground text-sm leading-[21px]">
          {formatDate(workbook.createdAt)}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-foreground text-sm font-medium leading-[18px] tracking-[0.02em]">
          {tCommon("common.updated")}
        </span>
        <span className="text-muted-foreground text-sm leading-[21px]">
          {formatDate(workbook.updatedAt)}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-foreground text-sm font-medium leading-[18px] tracking-[0.02em]">
          {tCommon("common.createdBy")}
        </span>
        <span className="text-muted-foreground text-sm leading-[21px]">
          {workbook.createdByName ?? "-"}
        </span>
      </div>
      <OwningOrganizationField
        resourceType="workbook"
        resourceId={id}
        organizationId={workbook.organizationId}
        organizationName={workbook.organizationName}
        canTransfer={canTransfer}
        layout="meta"
      />
      <div className="flex flex-col gap-1">
        <span className="text-foreground text-sm font-medium leading-[18px] tracking-[0.02em]">
          {t("workbooks.version")}
        </span>
        {isLoadingVersions ? (
          <Skeleton className="h-[21px] w-10" />
        ) : isVersionsError ? (
          // Don't claim "Draft" when the version state is simply unknown.
          <span className="text-muted-foreground text-sm leading-[21px]">-</span>
        ) : latestVersion != null ? (
          <WorkbookVersionBadge currentVersion={latestVersion} showUpgrade={false} />
        ) : (
          <span className="text-muted-foreground text-sm leading-[21px]">
            {t("workbooks.draftVersion")}
          </span>
        )}
      </div>
      {workbook.forkedFrom ? (
        <div className="flex flex-col gap-1">
          <span className="text-foreground text-sm font-medium leading-[18px] tracking-[0.02em]">
            {t("workbooks.forkedFrom")}
          </span>
          <Link
            href={`/platform/workbooks/${workbook.forkedFrom}`}
            className="text-primary hover:text-primary text-sm leading-[21px] underline underline-offset-2"
          >
            {tCommon("common.viewOriginal")}
          </Link>
        </div>
      ) : null}

      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1.5">
          <span className="text-foreground text-sm font-medium leading-[18px] tracking-[0.02em]">
            {tCommon("resourceVisibility.statusLabel")}
          </span>
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                {/* The copy is the icon's accessible name too, so it is readable
                    without hovering. */}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="text-muted-foreground"
                  aria-label={publishHelpText}
                >
                  <Info className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs leading-snug">
                {publishHelpText}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <span className="text-muted-foreground text-sm leading-[21px]">
          {isPublic
            ? tCommon("resourceVisibility.publicStatus")
            : tCommon("resourceVisibility.privateStatus")}
        </span>
      </div>

      {/* Narrow screens give the actions a line of their own and let them share
          its full width; from `sm` up they shrink to their labels and sit at the
          end of the row. */}
      <div className="flex w-full items-center gap-2 self-center sm:ml-auto sm:w-auto">
        {/* Nothing left to offer once public, so the action goes rather than
            lingering as an inert control. */}
        {canManage && !isPublic && (
          <Button
            variant="outline"
            size="sm"
            className="flex-1 sm:flex-none"
            onClick={() => setShowPublishConfirm(true)}
          >
            <Globe className="mr-2 h-4 w-4" />
            {tCommon("resourceVisibility.publishAction")}
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          className="flex-1 sm:flex-none"
          onClick={handleFork}
          disabled={isForking}
        >
          {isForking ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <GitFork className="mr-2 h-4 w-4" />
          )}
          {t("workbooks.actions.fork")}
        </Button>
        <WorkbookDeleteAction
          workbookId={id}
          workbookName={workbook.name}
          usedBy={workbook.experimentCount ?? 0}
          canManage={canManage}
        />
      </div>

      <PublishConfirmDialog
        open={showPublishConfirm}
        onOpenChange={setShowPublishConfirm}
        onConfirm={() => void handlePublish()}
        isPending={isPublishing}
      />
    </div>
  );
}
