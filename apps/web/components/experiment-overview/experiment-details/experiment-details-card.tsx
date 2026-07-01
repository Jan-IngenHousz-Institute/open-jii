"use client";

import { useLocale } from "@/hooks/useLocale";
import { formatDate } from "@/util/date";
import { ChevronDown, ChevronUp, PanelRightClose, PanelRightOpen } from "lucide-react";
import { useEffect, useState } from "react";

import type {
  Experiment,
  ExperimentLocation,
} from "@repo/api/domains/experiment/experiment.schema";
import type { ExperimentMember } from "@repo/api/domains/experiment/members/experiment-members.schema";
import { useSession } from "@repo/auth/client";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent, CardHeader } from "@repo/ui/components/card";
import { cn, cva } from "@repo/ui/lib/utils";

import { ExperimentRequestToJoin } from "../../experiment-settings/collaborators/experiment-request-to-join";
import { ExperimentInfoCard } from "../../experiment-settings/experiment-info-card";
import { ExperimentVisibilityCard } from "../../experiment-settings/experiment-visibility-card";
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
  members: ExperimentMember[];
  isMembersLoading: boolean;
  hasAccess?: boolean;
  isArchived?: boolean;
}

export function ExperimentDetailsCard({
  experimentId,
  experiment,
  locations,
  members,
  isMembersLoading,
  hasAccess = false,
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
  const currentMember = members.find((m) => m.user.id === currentUserId);
  const currentUserRole = currentMember?.role;
  const canRequestToJoin =
    currentUserId && !currentMember && !isArchived && experiment.visibility === "public";

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
                  <h4 className="text-sm font-medium">
                    {tSettings("experimentSettings.membersTab")}
                  </h4>
                  <ExperimentMembersTrail
                    members={members}
                    isLoading={isMembersLoading}
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

              {currentUserRole === "admin" ? (
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
                members={members}
              />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
