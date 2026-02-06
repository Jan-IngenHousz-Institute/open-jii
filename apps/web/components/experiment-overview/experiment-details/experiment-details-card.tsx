"use client";

import { formatDate } from "@/util/date";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

import type { Experiment, ExperimentMember, Location } from "@repo/api";
import { useSession } from "@repo/auth/client";
import { useTranslation } from "@repo/i18n";
import { Button, Card, CardContent, CardHeader } from "@repo/ui/components";

import { ExperimentInfoCard } from "../../experiment-settings/experiment-info-card";
import { ExperimentMemberManagement } from "../../experiment-settings/experiment-member-management-card";
import { ExperimentVisibilityCard } from "../../experiment-settings/experiment-visibility-card";
import { ExperimentLocationsSection } from "./experiment-locations-section";

interface ExperimentDetailsCardProps {
  experimentId: string;
  experiment: Experiment;
  locations: Location[];
  members: ExperimentMember[];
  isMembersLoading: boolean;
  isMembersError: boolean;
  hasAccess?: boolean;
  isArchived?: boolean;
}

export function ExperimentDetailsCard({
  experimentId,
  experiment,
  locations,
  members,
  isMembersLoading,
  isMembersError,
  hasAccess = false,
  isArchived = false,
}: ExperimentDetailsCardProps) {
  const { t } = useTranslation("experiments");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const { data: session } = useSession();
  const currentUserId = session?.user.id;
  const currentMember = members.find((m) => m.user.id === currentUserId);
  const currentUserRole = currentMember?.role;

  return (
    <div className="w-full md:order-2 md:w-96">
      <Card className="relative shadow-none">
        {/* Collapse Button */}
        <Button
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          variant="ghost"
          className={`absolute right-4 z-20 flex items-center justify-center md:hidden dark:bg-gray-900/80 ${isSidebarCollapsed ? "top-1/2 -translate-y-1/2" : "top-4 translate-y-0"} `}
        >
          {isSidebarCollapsed ? (
            <ChevronDown className="!h-6 !w-6" />
          ) : (
            <ChevronUp className="!h-6 !w-6" />
          )}
        </Button>

        <CardHeader>
          <h3 className="text-lg font-semibold">{t("detailsTitle")}</h3>
        </CardHeader>

        {isSidebarCollapsed && (
          <div className="text-muted-foreground -mt-6 truncate px-6 pb-3 text-sm md:hidden">
            {t("updated")} {formatDate(experiment.updatedAt)}, {t("experimentId")} {experiment.id}
          </div>
        )}

        {/* Collapsible Content on Mobile, Always Visible on Desktop */}
        <div className={`md:block ${isSidebarCollapsed ? "hidden" : "block"}`}>
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
              <h4 className="text-sm font-medium">{t("updated")}</h4>
              <p className="text-muted-foreground text-sm">{formatDate(experiment.updatedAt)}</p>
            </div>

            <div className="space-y-1">
              <h4 className="text-sm font-medium">{t("created")}</h4>
              <p className="text-muted-foreground text-sm">{formatDate(experiment.createdAt)}</p>
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
              isArchived={isArchived}
            />
          ) : null}

          <div
            role="separator"
            aria-orientation="horizontal"
            className="text-muted-foreground mx-4 border-t"
          />

          <ExperimentMemberManagement
            experimentId={experimentId}
            members={members}
            isLoading={isMembersLoading}
            isError={isMembersError}
            isArchived={isArchived}
          />
        </div>
      </Card>
      <div className={`md:block ${isSidebarCollapsed ? "hidden" : "block"}`}>
        <ExperimentInfoCard experimentId={experimentId} experiment={experiment} members={members} />
      </div>
    </div>
  );
}
