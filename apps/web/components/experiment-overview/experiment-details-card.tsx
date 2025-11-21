"use client";

import { formatDate } from "@/util/date";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

import type { Experiment, ExperimentMember, Location } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import { Button, Card, CardContent, CardHeader } from "@repo/ui/components";

import { ExperimentInfoCard } from "../experiment-settings/experiment-info-card";
import { ExperimentMemberManagement } from "../experiment-settings/experiment-member-management-card";
import { ExperimentVisibilityCard } from "../experiment-settings/experiment-visibility-card";

interface ExperimentDetailsCardProps {
  experimentId: string;
  experiment: Experiment;
  locations: Location[];
  members: ExperimentMember[];
  isMembersLoading: boolean;
  isMembersError: boolean;
  isArchived?: boolean;
}

export function ExperimentDetailsCard({
  experimentId,
  experiment,
  locations,
  members,
  isMembersLoading,
  isMembersError,
  isArchived = false,
}: ExperimentDetailsCardProps) {
  const { t } = useTranslation("experiments");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);

  return (
    <div className="w-full md:order-2 md:w-96">
      <Card className="relative">
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
            Updated {formatDate(experiment.updatedAt)}, Experiment ID {experiment.id}
          </div>
        )}

        {/* Collapsible Content on Mobile, Always Visible on Desktop */}
        <div className={`md:block ${isSidebarCollapsed ? "hidden" : "block"}`}>
          <CardContent className="space-y-4">
            <div>
              <h4 className="text-sm font-medium">{t("experimentId")}</h4>
              <p className="text-muted-foreground">{experiment.id}</p>
            </div>

            {locations.length > 0 && (
              <div>
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium">Experiment location(s)</h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="locations-action"
                    className="text-primary"
                  >
                    Add
                  </Button>
                </div>
                <div className="text-muted-foreground">
                  {locations.map((location) => (
                    <p key={location.id} className="truncate">
                      {location.name}
                    </p>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h4 className="text-sm font-medium">{t("updated")}</h4>
              <p className="text-muted-foreground">{formatDate(experiment.updatedAt)}</p>
            </div>

            <div>
              <h4 className="text-sm font-medium">{t("created")}</h4>
              <p className="text-muted-foreground">{formatDate(experiment.createdAt)}</p>
            </div>

            <div>
              <h4 className="text-sm font-medium">{t("createdBy")}</h4>
              <p className="text-muted-foreground">
                {experiment.ownerFirstName} {experiment.ownerLastName}
              </p>
            </div>
          </CardContent>

          <div
            role="separator"
            aria-orientation="horizontal"
            className="text-muted-foreground mx-4 border-t"
          />
          <ExperimentVisibilityCard
            experimentId={experimentId}
            initialVisibility={experiment.visibility}
            embargoUntil={experiment.embargoUntil}
            isArchived={isArchived}
          />

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
