import { router } from "expo-router";
import React, { useCallback, useEffect } from "react";
import { ActivityIndicator, FlatList, RefreshControl, Text, View } from "react-native";
import { DirectoryEmptyState } from "~/features/discover/components/directory-empty-state";
import { OrganizationCard } from "~/features/discover/components/organization-card";
import { useOrganizationDirectory } from "~/features/organizations/hooks/use-organization-directory";
import { useTranslation } from "~/shared/i18n";
import { Button } from "~/shared/ui/Button";
import { useThemeColors } from "~/shared/ui/hooks/use-theme-colors";

interface OrganizationsSectionProps {
  /** Already debounced by the hub; both sections read the same term. */
  search: string;
  enabled: boolean;
  onStatusChange: (status: { count: number; isFetching: boolean }) => void;
}

export function OrganizationsSection({
  search,
  enabled,
  onStatusChange,
}: OrganizationsSectionProps) {
  const themeColors = useThemeColors();
  const { t } = useTranslation(["organizations", "common"]);

  const { organizations, isLoading, isFetching, isPaused, error, refetch, isRefetching } =
    useOrganizationDirectory({ search, enabled });

  const count = organizations?.length ?? 0;
  useEffect(() => {
    onStatusChange({ count, isFetching });
  }, [count, isFetching, onStatusChange]);

  const openOrganization = useCallback((id: string) => {
    router.push({ pathname: "/organizations/[id]", params: { id } });
  }, []);

  const hasAppliedTerm = search.trim().length > 0;

  if (isLoading) {
    return (
      <View className="items-center py-10">
        <ActivityIndicator size="large" color={themeColors.brand} />
        <Text className="text-muted-body mt-3 text-center">{t("organizations:loading")}</Text>
      </View>
    );
  }

  if (!organizations || (error && organizations.length === 0)) {
    return (
      <View className="items-center gap-3 py-10">
        {/* Paused means offlineFirst gave up before the network, so there is
            no error to report as one. */}
        <Text className="text-error text-center">
          {t(isPaused && !error ? "organizations:offline" : "organizations:loadFailed")}
        </Text>
        <Button title={t("common:retry")} onPress={() => void refetch()} variant="light" />
      </View>
    );
  }

  return (
    <FlatList
      data={organizations}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={() => void refetch()}
          tintColor={themeColors.brand}
          colors={[themeColors.brand]}
        />
      }
      ListEmptyComponent={<DirectoryEmptyState hasSearchTerm={hasAppliedTerm} />}
      renderItem={({ item }) => <OrganizationCard organization={item} onPress={openOrganization} />}
    />
  );
}
