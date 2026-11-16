"use client";

import { Building2, Mail, Plus } from "lucide-react";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";

/** People beyond the experiment come from its organization, or by email for someone without an account. */
export function AddPersonMenu({ onAddByEmail }: { onAddByEmail: () => void }) {
  const { t } = useTranslation("datasets");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Plus className="size-4" />
          {t("describe.addPerson")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem>
          <Building2 className="mr-2 size-4" />
          {t("describe.addFromOrganization")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onAddByEmail}>
          <Mail className="mr-2 size-4" />
          {t("describe.addByEmail")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
