import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components";

export const ExperimentStatusBadge = ({ status }: { status: string }) => {
  const { t } = useTranslation("experiments");

  switch (status) {
    case "active":
      return <Badge className="bg-secondary">{t("status.active")}</Badge>;
    case "provisioning":
      return <Badge className="bg-highlight text-black">{t("status.provisioning")}</Badge>;
    case "archived":
      return <Badge className="bg-muted">{t("status.archived")}</Badge>;
    case "stale":
      return <Badge className="bg-tertiary">{t("status.stale")}</Badge>;
    default:
      return <Badge>{status}</Badge>;
  }
};
