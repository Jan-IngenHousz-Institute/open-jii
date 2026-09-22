import React from "react";
import { Text, View } from "react-native";
import { useTranslation } from "~/shared/i18n";

interface DirectoryEmptyStateProps {
  hasSearchTerm: boolean;
}

export function DirectoryEmptyState({ hasSearchTerm }: DirectoryEmptyStateProps) {
  const { t } = useTranslation("organizations");

  return (
    <View className="items-center py-10">
      <Text className="text-muted-body text-center">
        {hasSearchTerm ? t("search.noResults") : t("empty")}
      </Text>
    </View>
  );
}
