"use client";

import { ResourcePublishControl } from "@/components/visibility/resource-publish-control";
import { WorkbookVersionBadge } from "@/components/workbook/workbook-version-badge";
import { useLocale } from "@/hooks/useLocale";
import { useWorkbookCreate } from "@/hooks/workbook/useWorkbookCreate/useWorkbookCreate";
import { useWorkbookVersions } from "@/hooks/workbook/useWorkbookVersions/useWorkbookVersions";
import { formatDate } from "@/util/date";
import { GitFork, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import type { WorkbookDetail } from "@repo/api/domains/workbook/workbook.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Skeleton } from "@repo/ui/components/skeleton";

interface WorkbookMetaRowProps {
  id: string;
  workbook: WorkbookDetail;
}

/**
 * The workbook's provenance row: created / updated / created by / version /
 * forked-from, plus the publish control and the Fork action.
 *
 * It belongs to the workbook's Overview, not to the title block above the tab
 * strip — the Collaborators route is about who has access, and none of this
 * answers that. The version fetch and the fork mutation travel with it so
 * neither runs on the route that does not show them.
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

  // Versions are returned newest-first; the live page is the draft, so the
  // latest published version is the meaningful number to surface here.
  const latestVersion = versionsData?.[0]?.version;
  // Capability, not ownership: a "Can edit" grantee renames and edits.
  const { canManage } = workbook.capabilities;

  return (
    <div className="flex items-start gap-10 border-b border-[#EDF2F6] pb-8">
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium leading-[18px] tracking-[0.02em] text-[#011111]">
          {tCommon("common.created")}
        </span>
        <span className="text-sm leading-[21px] text-[#68737B]">
          {formatDate(workbook.createdAt)}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium leading-[18px] tracking-[0.02em] text-[#011111]">
          {tCommon("common.updated")}
        </span>
        <span className="text-sm leading-[21px] text-[#68737B]">
          {formatDate(workbook.updatedAt)}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium leading-[18px] tracking-[0.02em] text-[#011111]">
          {tCommon("common.createdBy")}
        </span>
        <span className="text-sm leading-[21px] text-[#68737B]">
          {workbook.createdByName ?? "-"}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium leading-[18px] tracking-[0.02em] text-[#011111]">
          {t("workbooks.version")}
        </span>
        {isLoadingVersions ? (
          <Skeleton className="h-[21px] w-10" />
        ) : isVersionsError ? (
          // Don't claim "Draft" when the version state is simply unknown.
          <span className="text-sm leading-[21px] text-[#68737B]">-</span>
        ) : latestVersion != null ? (
          <WorkbookVersionBadge currentVersion={latestVersion} showUpgrade={false} />
        ) : (
          <span className="text-sm leading-[21px] text-[#68737B]">
            {t("workbooks.draftVersion")}
          </span>
        )}
      </div>
      {workbook.forkedFrom ? (
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium leading-[18px] tracking-[0.02em] text-[#011111]">
            {t("workbooks.forkedFrom")}
          </span>
          <Link
            href={`/platform/workbooks/${workbook.forkedFrom}`}
            className="text-sm leading-[21px] text-[#005E5E] underline underline-offset-2 hover:text-[#004848]"
          >
            {tCommon("common.viewOriginal")}
          </Link>
        </div>
      ) : null}

      {/* Visibility. The cell needs a floor width of its own: the select sizes to
          its container, and this container would otherwise shrink to the width of
          the word above it. Even so it is one short cell in a horizontal row, so
          the explanatory copy goes on the info icon — a block would wrap here and
          push the row out of line. */}
      <div className="flex min-w-[9rem] flex-col gap-1">
        <ResourcePublishControl
          resourceType="workbook"
          resourceId={id}
          visibility={workbook.visibility}
          canManage={canManage}
          infoPlacement="tooltip"
        />
      </div>

      <div className="ml-auto self-center">
        <Button variant="outline" size="sm" onClick={handleFork} disabled={isForking}>
          {isForking ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <GitFork className="mr-2 h-4 w-4" />
          )}
          {t("workbooks.actions.fork")}
        </Button>
      </div>
    </div>
  );
}
