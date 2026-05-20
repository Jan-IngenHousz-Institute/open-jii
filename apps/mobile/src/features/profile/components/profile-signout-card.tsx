import { LogOut } from "lucide-react-native";
import React from "react";
import { useLogout } from "~/features/auth/hooks/use-logout";
import { useTranslation } from "~/shared/i18n";
import { Card } from "~/shared/ui/Card";
import { RowItem } from "~/shared/ui/RowItem";

export function ProfileSignoutCard() {
  const { t } = useTranslation("profile");
  const handleLogout = useLogout();

  return (
    <Card padded={false}>
      <RowItem
        icon={<LogOut size={18} color="#b00020" />}
        title={t("signOut.title")}
        subtitle={t("signOut.subtitle")}
        onPress={handleLogout}
        danger
        isLast
      />
    </Card>
  );
}
