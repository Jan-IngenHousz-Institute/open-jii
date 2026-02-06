import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components";

export const ExperimentStatusBadge = ({ status }: { status: string }) => {
  const { t } = useTranslation("experiments");

  const baseClasses =
    "h-6 gap-2.5 rounded border-0 px-2 py-1 text-[#011111] shadow-none hover:bg-[--bg-color] pointer-events-none";

  switch (status) {
    case "active":
      return (
        <Badge className={`${baseClasses} bg-[#CCFCD8] [--bg-color:#CCFCD8]`}>
          {t("status.active")}
        </Badge>
      );
    case "archived":
      return (
        <Badge className={`${baseClasses} bg-[#E7EDF2] [--bg-color:#E7EDF2]`}>
          {t("status.archived")}
        </Badge>
      );
    case "stale":
      return (
        <Badge className={`${baseClasses} bg-[#FFE0B2] [--bg-color:#FFE0B2]`}>
          {t("status.stale")}
        </Badge>
      );
    default:
      return <Badge>{status}</Badge>;
  }
};
