"use client";

import { useExperimentLayoutAttributes } from "@/hooks/experiment/useExperimentLayoutAttributes/useExperimentLayoutAttributes";
import { useExperimentSessionWalkingOrder } from "@/hooks/experiment/useExperimentSessionWalkingOrder/useExperimentSessionWalkingOrder";
import { useState } from "react";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";

import type { AttributeRole } from "./layout-attribute-role-select";
import { LayoutAttributeRoleSelect } from "./layout-attribute-role-select";
import { FieldPlan } from "./sessions/field-plan";

interface LayoutAttributeRolesProps {
  experimentId: string;
  canEdit: boolean;
}

type Roles = Record<string, AttributeRole>;

const ROLE_BY_HEADER: Record<string, AttributeRole> = {
  treatment: "factor",
  genotype: "studiedMaterial",
  variety: "studiedMaterial",
  block: "grouping",
};

/** Suggests a role from each header, keeping at most one studied material. */
function suggestedRoles(names: readonly string[], blocksName: string | null): Roles {
  const roles: Roles = {};
  for (const name of names) {
    const fromHeader = ROLE_BY_HEADER[name.trim().toLowerCase()] ?? "none";
    const role = name === blocksName ? "grouping" : fromHeader;
    const isSecondMaterial =
      role === "studiedMaterial" && Object.values(roles).includes("studiedMaterial");
    roles[name] = isSecondMaterial ? "none" : role;
  }
  return roles;
}

/**
 * The role each plot attribute plays for the standards an experiment follows: a factor, the
 * studied material or a grouping. Only profiles read it.
 */
export function LayoutAttributeRoles({ experimentId, canEdit }: LayoutAttributeRolesProps) {
  const { t } = useTranslation("experiments");
  const { data: attributes } = useExperimentLayoutAttributes(experimentId, true);
  const { data: walkingOrder } = useExperimentSessionWalkingOrder(experimentId);
  const [chosen, setChosen] = useState<Roles | undefined>(undefined);
  const [isSaved, setIsSaved] = useState(false);

  const names = attributes?.names ?? [];
  const blocksName = walkingOrder ? FieldPlan.rolesOf(walkingOrder).blocksName : null;
  const roles = chosen ?? suggestedRoles(names, blocksName);

  const changeRole = (name: string, role: AttributeRole) => {
    const next: Roles = { ...roles, [name]: role };
    if (role === "studiedMaterial") {
      for (const other of names) {
        const isOtherMaterial = other !== name && next[other] === "studiedMaterial";
        if (isOtherMaterial) {
          next[other] = "none";
        }
      }
    }
    setChosen(next);
    setIsSaved(false);
  };

  // Scaffold: storing the roles is not built yet.
  const save = () => {
    setIsSaved(true);
  };

  const renderAttribute = (name: string) => (
    <LayoutAttributeRoleSelect
      key={name}
      name={name}
      role={roles[name] ?? "none"}
      canEdit={canEdit}
      onChange={changeRole}
    />
  );

  if (names.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 border-t pt-4" data-attribute-roles>
      <div className="space-y-0.5">
        <h4 className="text-sm font-medium">{t("layout.roles.title")}</h4>
        <p className="text-muted-foreground text-xs">{t("layout.roles.description")}</p>
      </div>
      <div className="space-y-3">{names.map(renderAttribute)}</div>
      {canEdit ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-muted-foreground text-xs" data-attribute-roles-state>
            {isSaved ? t("layout.roles.saved") : t("layout.roles.suggested")}
          </p>
          <Button variant="outline" size="sm" onClick={save} disabled={isSaved}>
            {t("layout.roles.save")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
