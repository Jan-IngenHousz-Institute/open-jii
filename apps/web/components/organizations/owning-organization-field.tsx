"use client";

import { useState } from "react";

import type { TransferableResourceType } from "@repo/api/domains/sharing/transfer-org/sharing-transfer-org.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";

import { OwningOrganizationValue } from "./owning-organization-value";
import { ResourceTransferDialog } from "./resource-transfer-dialog";

interface OwningOrganizationFieldProps {
  resourceType: TransferableResourceType;
  resourceId: string;
  organizationId: string | null | undefined;
  organizationName: string | null | undefined;
  /**
   * `canTransfer` from the detail response. Deliberately not `canManage`: moving a
   * resource out of an organization takes authority over that organization, and a
   * grant-holder with `manage` on the resource alone must not be able to walk it
   * into their own workspace and lock the owning organization out. The server
   * resolves the difference; this only mirrors its answer.
   */
  canTransfer: boolean;
  /**
   * `stacked` is the detail-sidebar field shape — label row with the affordance at
   * its end, value beneath. `meta` is the horizontal provenance strip, where a
   * column is too narrow to push a control to its far edge.
   */
  layout?: "stacked" | "meta";
}

/**
 * Which organization owns this resource, and — for whoever may move it — the way to
 * change it.
 *
 * Modelled on the locations field in the experiment header: the value's own label row
 * carries an inline link-styled affordance that opens a dialog holding the whole flow.
 * Transfer used to sit apart from this value, in each type's danger zone or action
 * row, which put the answer and the way to change it in two different places. One
 * home reads as one fact about the resource.
 *
 * Someone who cannot transfer sees exactly the plain value, with no inert control.
 */
export function OwningOrganizationField({
  resourceType,
  resourceId,
  organizationId,
  organizationName,
  canTransfer,
  layout = "stacked",
}: OwningOrganizationFieldProps) {
  const { t } = useTranslation();
  const [isTransferOpen, setIsTransferOpen] = useState(false);

  const isMeta = layout === "meta";

  return (
    <>
      <div className={isMeta ? "flex flex-col gap-1" : "space-y-1"}>
        <div className={isMeta ? "flex items-center gap-2" : "flex items-center justify-between"}>
          <h4
            className={
              isMeta
                ? "text-sm font-medium leading-[18px] tracking-[0.02em] text-[#011111]"
                : "text-sm font-medium"
            }
          >
            {t("organizations.owningOrganization")}
          </h4>
          {canTransfer && (
            <Button
              variant="buttonLink"
              className="h-auto p-0"
              onClick={() => setIsTransferOpen(true)}
            >
              {t("organizations.transfer.action")}
            </Button>
          )}
        </div>
        <OwningOrganizationValue
          organizationId={organizationId}
          organizationName={organizationName}
          className={
            isMeta ? "text-sm leading-[21px] text-[#68737B]" : "text-muted-foreground text-sm"
          }
        />
      </div>

      {/* Mounted only once reachable, so a viewer who cannot transfer never has the
          flow — or the memberships read behind it — in their page at all. */}
      {canTransfer && (
        <ResourceTransferDialog
          resourceType={resourceType}
          resourceId={resourceId}
          currentOrganizationId={organizationId ?? null}
          open={isTransferOpen}
          onOpenChange={setIsTransferOpen}
        />
      )}
    </>
  );
}
