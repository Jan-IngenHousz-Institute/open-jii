"use client";

import { Plus, UserPlus, UserRound } from "lucide-react";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";

/** Authors come from the experiment's members, or by name for someone without an account. */
export function AddAuthorMenu() {
  const { t } = useTranslation("datasets");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Plus className="size-4" />
          {t("describe.addAuthor")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem>
          <UserRound className="mr-2 size-4" />
          {t("describe.addMember")}
        </DropdownMenuItem>
        <DropdownMenuItem>
          <UserPlus className="mr-2 size-4" />
          {t("describe.addByName")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
