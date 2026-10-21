import { UserPlus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { EmptyState } from "@repo/ui/components/empty-state";

interface InviteMeasurerProps {
  canInvite: boolean;
}

/** The divide panel when nobody but the researcher is a member, so nobody can take a share. */
export function InviteMeasurer({ canInvite }: InviteMeasurerProps) {
  const { t } = useTranslation("fieldSessions");
  // Scaffold: opens the Collaborators tab, where the invite dialog lives today.
  const collaborators = usePathname().replace(/\/layout$/, "/collaborators");

  return (
    <EmptyState
      icon={<UserPlus aria-hidden />}
      title={t("divide.inviteTitle")}
      description={t("divide.inviteDescription")}
      action={
        canInvite ? (
          <Button asChild variant="outline">
            <Link href={collaborators}>{t("divide.invite")}</Link>
          </Button>
        ) : undefined
      }
    />
  );
}
