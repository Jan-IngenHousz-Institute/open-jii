"use client";

import type { CreateExperimentBody } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import { Button, Card, CardHeader, CardTitle, CardContent, Badge } from "@repo/ui/components";

import { embargoUntilHelperString } from "../../embargo-utils";

interface MembersVisibilitySectionProps {
  formData: CreateExperimentBody;
  onEdit: () => void;
}

export function MembersVisibilitySection({ formData, onEdit }: MembersVisibilitySectionProps) {
  const { t } = useTranslation();
  const embargoPublicDate = embargoUntilHelperString(formData.embargoUntil, t);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base font-semibold">
          {t("experiments.membersAndVisibility")}
        </CardTitle>
        <Button type="button" onClick={onEdit} variant="link" size="sm">
          {t("common.edit")}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3">
          <div>
            <div className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wider">
              {t("experimentSettings.visibility")}
            </div>
            <Badge variant="outline" className="px-3 py-1 font-medium capitalize">
              {formData.visibility ?? "public"}
            </Badge>
          </div>

          {formData.visibility !== "public" && formData.embargoUntil && embargoPublicDate && (
            <div className="bg-highlight/20 border-highlight rounded-md border p-3">
              <div className="mb-1 text-xs font-medium uppercase tracking-wider">
                {t("experiments.embargo")}
              </div>
              <div className="text-sm font-medium">{embargoPublicDate}</div>
            </div>
          )}

          <div>
            <div className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wider">
              {t("experiments.teamMembers")} ({formData.members?.length ?? 0})
            </div>
            {formData.members?.length ? (
              <div className="grid gap-2">
                {formData.members.map((m, i) => (
                  <div
                    key={m.userId || i}
                    className="flex items-center gap-2 rounded-md border px-3 py-2"
                  >
                    <div className="bg-primary/10 flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium">
                      {(m.firstName?.[0] ?? m.lastName?.[0] ?? "U").toUpperCase()}
                    </div>
                    <div className="text-sm font-medium">
                      {m.firstName || m.lastName
                        ? `${m.firstName ?? ""} ${m.lastName ?? ""}`.trim()
                        : t("experiments.unnamedMember")}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-muted-foreground text-sm italic">
                {t("experiments.noMembersAdded")}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
