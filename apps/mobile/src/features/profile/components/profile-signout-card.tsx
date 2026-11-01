import { LogOut } from "lucide-react-native";
import React from "react";
import { useLogout } from "~/features/auth/hooks/use-logout";
import { useSession } from "~/features/auth/hooks/use-session";
import { colors } from "~/shared/constants/colors";
import { useTranslation } from "~/shared/i18n";
import { Card } from "~/shared/ui/Card";
import { RowItem } from "~/shared/ui/RowItem";

export function ProfileSignoutCard() {
  const { t } = useTranslation("profile");
  const handleLogout = useLogout();
  const { user } = useSession();
  if (user?.isAnonymous) return null;

  return (
    <Card padded={false}>
      <RowItem
        icon={<LogOut size={18} color={colors.semantic.error} />}
        title={t("signOut.title")}
        subtitle={t("signOut.subtitle")}
        onPress={handleLogout}
        danger
        isLast
      />
    </Card>
  );
}
