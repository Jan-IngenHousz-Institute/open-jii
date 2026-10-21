import { Text } from "react-native";
import { useTranslation } from "~/shared/i18n";

export function SimulatedLabel() {
  const { t } = useTranslation("common");
  return (
    <Text className="text-muted-body py-1 text-sm font-semibold">{t("common:simulated")}</Text>
  );
}
