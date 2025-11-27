import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components";

export const ExperimentStatusBadge = ({ status }: { status: string }) => {
  const { t } = useTranslation("experiments");

  switch (status) {
    case "active":
      return <Badge className="bg-secondary text-white">{t("status.active")}</Badge>;
    case "provisioning":
      return (
        <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
          {t("status.provisioning")}
        </Badge>
      );
    case "archived":
      return (
        <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">
          {t("status.archived")}
        </Badge>
      );
    case "stale":
      return (
        <Badge className="bg-red-100 text-red-800 hover:bg-red-100">{t("status.stale")}</Badge>
      );
    case "provisioning_failed":
      return (
        <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
          {t("status.provisioningFailed")}
        </Badge>
      );
    default:
      return <Badge>{status}</Badge>;
  }
};
