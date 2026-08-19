"use client";

import { useLocale } from "@/hooks/useLocale";
import { formatDate } from "@/util/date";
import { ChevronDown, ChevronUp, PanelRightClose, PanelRightOpen } from "lucide-react";
import { useEffect, useState } from "react";

import type { ExperimentContributor } from "@repo/api/domains/experiment/contributors/experiment-contributors.schema";
import type { Experiment } from "@repo/api/domains/experiment/experiment.schema";
import type { ExperimentLocation } from "@repo/api/domains/experiment/locations/experiment-locations.schema";
import { useSession } from "@repo/auth/client";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent, CardHeader } from "@repo/ui/components/card";
import { cn, cva } from "@repo/ui/lib/utils";

import { ExperimentRequestToJoin } from "../../experiment-settings/collaborators/experiment-request-to-join";
import { ExperimentInfoCard } from "../../experiment-settings/experiment-info-card";
import { ExperimentVisibilityCard } from "../../experiment-settings/experiment-visibility-card";
import { OwningOrganizationField } from "../../organizations/owning-organization-field";
import { ExperimentMembersTrail } from "../experiment-members-trail";
import { ExperimentLocationsSection } from "./experiment-locations-section";

const DETAILS_PANEL_STORAGE_KEY = "experiment_details_panel_collapsed";

const panelWrapperVariants = cva("relative w-full overflow-hidden md:order-2", {
  variants: {
    collapsed: { true: "md:w-10", false: "md:w-96" },
    transitionsReady: {
      true: "md:transition-[width] md:duration-300 md:ease-in-out",
      false: "",
    },
  },
  defaultVariants: { collapsed: false, transitionsReady: false },
});

const panelContentVariants = cva("w-full md:w-96", {
  variants: {
    collapsed: { true: "md:translate-x-full", false: "md:translate-x-0" },
    transitionsReady: {
      true: "md:transition-transform md:duration-300 md:ease-in-out",
      false: "",
    },
  },
  defaultVariants: { collapsed: false, transitionsReady: false },
});

interface ExperimentDetailsCardProps {
  experimentId: string;
  experiment: Experiment;
  locations: ExperimentLocation[];
  contributors: ExperimentContributor[];
  /** Every collaborator row, not just the creditable faces — see the trail. */
  collaboratorCount: number;
  /** The contributors read failed; the trail must not claim a zero. */
  isContributorsError?: boolean;
  isContributorsLoading: boolean;
  hasAccess?: boolean;
  /** `can(manage)` from the experiment-access response — gates the admin-only cards. */
  canManage?: boolean;
  /**
   * `can(transfer)` — narrower than `canManage`: moving the experiment out of its
   * organization also takes authority over that organization.
   */
  canTransfer?: boolean;
  /** `can(contribute)` — whether this person is already a collaborator. */
  canContribute?: boolean;
  isArchived?: boolean;
}

export function ExperimentDetailsCard({
  experimentId,
  experiment,
  locations,
  contributors,
  collaboratorCount,
  isContributorsError = false,
  isContributorsLoading,
  hasAccess = false,
  canManage = false,
  canTransfer = false,
  canContribute = false,
  isArchived = false,
}: ExperimentDetailsCardProps) {
  const { t } = useTranslation("experiments");
  const { t: tSettings } = useTranslation();
  const locale = useLocale();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileCollapsed, setIsMobileCollapsed] = useState(true);
  const [transitionsReady, setTransitionsReady] = useState(false);
  const { data: session } = useSession();
  const currentUserId = session?.user.id;
  // Anyone who already contributes has nothing to request; `canContribute` is the
  // server's answer to "is this person already a collaborator".
  const canRequestToJoin =
    currentUserId && !canContribute && !isArchived && experiment.visibility === "public";

  useEffect(() => {
    const stored = localStorage.getItem(DETAILS_PANEL_STORAGE_KEY);
    if (stored === "true") setIsCollapsed(true);
    // Enable transitions only after the initial state is painted
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setTransitionsReady(true));
    });
  }, []);

  const toggleCollapsed = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    localStorage.setItem(DETAILS_PANEL_STORAGE_KEY, String(next));
  };

  return (
    <div className={panelWrapperVariants({ collapsed: isCollapsed, transitionsReady })}>
      {/* Desktop toggle button — anchored to the right edge, stays put while the panel slides */}
      <Button
        onClick={toggleCollapsed}
        variant="ghost"
        size="icon"
        className="absolute right-2 top-[10px] z-20 hidden h-8 w-8 md:flex"
        aria-label={isCollapsed ? t("openDetailsPanel") : t("closeDetailsPanel")}
      >
        {isCollapsed ? (
          <PanelRightOpen className="!h-5 !w-5" />
        ) : (
          <PanelRightClose className="!h-5 !w-5" />
        )}
      </Button>

      {/* Panel content — slides right on desktop collapse */}
      <div className={panelContentVariants({ collapsed: isCollapsed, transitionsReady })}>
        <Card className="relative shadow-none">
          {/* Mobile toggle button */}
          <Button
            onClick={() => setIsMobileCollapsed(!isMobileCollapsed)}
            variant="ghost"
            size="icon"
            className="absolute right-2 top-[10px] z-20 h-8 w-8 md:hidden"
            aria-label={isMobileCollapsed ? t("expandDetails") : t("collapseDetails")}
          >
            {isMobileCollapsed ? (
              <ChevronDown className="!h-5 !w-5" />
            ) : (
              <ChevronUp className="!h-5 !w-5" />
            )}
          </Button>

          <CardHeader className="py-3 pr-10">
            <h3 className="text-lg font-semibold">{t("detailsTitle")}</h3>
          </CardHeader>

          {/* Mobile collapsed summary */}
          {isMobileCollapsed && (
            <div className="text-muted-foreground -mt-2 truncate px-6 pb-3 text-sm md:hidden">
              {t("updated")} {formatDate(experiment.updatedAt)}, {t("experimentId")} {experiment.id}
            </div>
          )}

          {/* Content — animated height collapse on mobile, always visible on desktop */}
          <div
            className={cn(
              "grid transition-[grid-template-rows] duration-300 ease-in-out md:grid-rows-[1fr]",
              isMobileCollapsed ? "grid-rows-[0fr]" : "grid-rows-[1fr]",
            )}
          >
            <div className="overflow-hidden">
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <h4 className="text-sm font-medium">{t("experimentId")}</h4>
                  <p className="text-muted-foreground text-sm">{experiment.id}</p>
                </div>

                <ExperimentLocationsSection
                  experimentId={experimentId}
                  locations={locations}
                  hasAccess={hasAccess}
                  isArchived={isArchived}
                />

                <div className="space-y-1">
                  <h4 className="text-sm font-medium">{tSettings("sharing.collaboratorsTab")}</h4>
                  <ExperimentMembersTrail
                    contributors={contributors}
                    collaboratorCount={collaboratorCount}
                    isError={isContributorsError}
                    isLoading={isContributorsLoading}
                    href={`/${locale}/platform/experiments${isArchived ? "-archive" : ""}/${experimentId}/collaborators`}
                  />
                </div>

                <div className="space-y-1">
                  <h4 className="text-sm font-medium">{t("updated")}</h4>
                  <p className="text-muted-foreground text-sm">
                    {formatDate(experiment.updatedAt)}
                  </p>
                </div>

                <div className="space-y-1">
                  <h4 className="text-sm font-medium">{t("created")}</h4>
                  <p className="text-muted-foreground text-sm">
                    {formatDate(experiment.createdAt)}
                  </p>
                </div>

                <OwningOrganizationField
                  resourceType="experiment"
                  resourceId={experimentId}
                  organizationId={experiment.organizationId}
                  organizationName={experiment.organizationName}
                  canTransfer={canTransfer}
                />

                <div className="space-y-1">
                  <h4 className="text-sm font-medium">{t("createdBy")}</h4>
                  <p className="text-muted-foreground text-sm">
                    {experiment.ownerFirstName} {experiment.ownerLastName}
                  </p>
                </div>
              </CardContent>

              <div
                role="separator"
                aria-orientation="horizontal"
                className="text-muted-foreground mx-4 border-t"
              />

              {canManage ? (
                <ExperimentVisibilityCard
                  experimentId={experimentId}
                  initialVisibility={experiment.visibility}
                  embargoUntil={experiment.embargoUntil}
                  initialAnonymize={experiment.anonymizeContributors}
                  isArchived={isArchived}
                />
              ) : null}

              {canRequestToJoin ? (
                <div className="px-6 py-4">
                  <ExperimentRequestToJoin experimentId={experimentId} />
                </div>
              ) : null}

              <ExperimentInfoCard
                experimentId={experimentId}
                experiment={experiment}
                canManage={canManage}
              />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
