import { Building2, ChevronRight } from "lucide-react-native";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { colors } from "~/shared/constants/colors";
import { useTranslation } from "~/shared/i18n";
import { Avatar } from "~/shared/ui/Avatar";
import { Card } from "~/shared/ui/Card";
import { useThemeColors } from "~/shared/ui/hooks/use-theme-colors";
import { OrganizationMembershipTags } from "~/shared/ui/organization-membership-tag";
import { organizationTypeLabelKey } from "~/shared/ui/organization-type-label";

import type { OrganizationDirectoryEntry } from "@repo/api/domains/organization/organization.schema";

interface OrganizationCardProps {
  organization: OrganizationDirectoryEntry;
  onPress: (id: string) => void;
}

export function OrganizationCard({ organization, onPress }: OrganizationCardProps) {
  const themeColors = useThemeColors();
  const { t } = useTranslation("organizations");

  const typeKey = organizationTypeLabelKey(organization.type);
  const meta = [
    typeKey ? t(typeKey) : null,
    organization.location,
    t("memberCount", { count: organization.memberCount }),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Pressable
      onPress={() => onPress(organization.id)}
      accessibilityRole="button"
      className="active:opacity-60"
    >
      <Card padded style={{ marginVertical: 0, marginTop: 10, padding: 12 }}>
        <View className="flex-row items-center gap-3">
          <Avatar
            uri={organization.logo ?? undefined}
            size={44}
            icon={<Building2 size={20} color={colors.jii.darkGreen} />}
          />
          <View className="min-w-0 flex-1">
            <View className="flex-row items-center gap-2">
              <Text
                className="text-on-surface font-poppins-bold min-w-0 shrink text-[15px] leading-[19px]"
                numberOfLines={1}
              >
                {organization.name}
              </Text>
              <OrganizationMembershipTags
                visibility={organization.visibility}
                membershipStatus={organization.membershipStatus}
              />
            </View>
            <Text className="text-muted-body mt-0.5 text-[12.5px]" numberOfLines={1}>
              {meta}
            </Text>
          </View>
          <ChevronRight size={18} color={themeColors.inactive} />
        </View>
      </Card>
    </Pressable>
  );
}
