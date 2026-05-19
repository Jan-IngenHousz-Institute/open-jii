import React from "react";
import { Text, View } from "react-native";
import { useTranslation } from "~/shared/i18n";
import { Avatar } from "~/shared/ui/Avatar";
import { Tag } from "~/shared/ui/Tag";

interface ProfileIdentityProps {
  name?: string;
  email?: string;
  imageUri?: string;
}

function initialsFrom(name: string | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "JII";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

export function ProfileIdentity({ name, email, imageUri }: ProfileIdentityProps) {
  const { t } = useTranslation("profile");
  return (
    <View className="my-6 items-center">
      <Avatar
        uri={imageUri}
        initials={initialsFrom(name)}
        size={80}
        backgroundClassName="bg-jii-mint"
        textClassName="text-jii-darker-green"
      />
      <Text
        className="text-on-surface mb-1 mt-3"
        style={{ fontFamily: "Poppins-Bold", fontSize: 18 }}
        numberOfLines={1}
      >
        {name}
      </Text>
      <Text className="text-muted-body text-[13px]" numberOfLines={1}>
        {email}
      </Text>
      <View className="mt-3 flex-row gap-2">
        <Tag variant="sensor">{t("identity.roleResearcher")}</Tag>
        <Tag>{t("identity.groupNL")}</Tag>
      </View>
    </View>
  );
}
