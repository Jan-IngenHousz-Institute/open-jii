import React from "react";
import { Text, View } from "react-native";
import { useSession } from "~/features/auth/hooks/use-session";
import { useGreeting } from "~/features/home/hooks/use-greeting";
import { useGetUserProfile } from "~/features/profile/hooks/use-get-user-profile";
import { useTranslation } from "~/shared/i18n";

export function HomeGreeting() {
  const { t } = useTranslation("home");
  const { user } = useSession();
  const { userProfile } = useGetUserProfile(user?.id);
  const { greeting, weekdayAndDate } = useGreeting();

  const fallback = t("greeting.fallbackName");
  // Profile firstName is the authoritative source; fall back to the session
  // name (set by OAuth providers) and finally to the localized "there".
  const profileFirst = userProfile?.firstName?.trim() ?? "";
  const sessionFirst = user?.name?.split(" ")[0]?.trim() ?? "";
  const firstName =
    profileFirst.length > 0 ? profileFirst : sessionFirst.length > 0 ? sessionFirst : fallback;

  return (
    <View className="pb-3 pt-1">
      <Text
        className="text-on-surface"
        style={{ fontFamily: "Poppins-Bold", fontSize: 28, lineHeight: 34 }}
      >
        {t("greeting.addressee", { greeting, name: firstName })}
      </Text>
      <Text className="text-muted-body mt-1 text-[14px]">{weekdayAndDate}</Text>
    </View>
  );
}
