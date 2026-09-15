import { router, useNavigation } from "expo-router";
import { Search, X } from "lucide-react-native";
import React, { useCallback, useLayoutEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { DirectoryEmptyState } from "~/features/organizations/components/directory-empty-state";
import { OrganizationCard } from "~/features/organizations/components/organization-card";
import {
  SEARCH_DEBOUNCE_MS,
  useDebouncedValue,
} from "~/features/organizations/hooks/use-debounced-value";
import { useOrganizationDirectory } from "~/features/organizations/hooks/use-organization-directory";
import { useTranslation } from "~/shared/i18n";
import { Input } from "~/shared/ui/Input";
import { Tag } from "~/shared/ui/Tag";
import { useThemeColors } from "~/shared/ui/hooks/use-theme-colors";

export function OrganizationsDirectoryScreen() {
  const themeColors = useThemeColors();
  const navigation = useNavigation();
  const { t } = useTranslation("organizations");

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
  const { organizations, isLoading, isFetching, error, refetch, isRefetching } =
    useOrganizationDirectory({ search: debouncedSearch });

  useLayoutEffect(() => {
    navigation.setOptions({ title: t("title") });
  }, [navigation, t]);

  const openOrganization = useCallback((id: string) => {
    router.push({ pathname: "/organizations/[id]", params: { id } });
  }, []);

  const isSearching = search.trim().length > 0;
  const hasAppliedTerm = debouncedSearch.trim().length > 0;

  return (
    <View className="flex-1">
      <View className="px-4 pb-2 pt-4">
        <Input
          value={search}
          onChangeText={setSearch}
          transparent
          placeholder={t("search.placeholder")}
          leftIcon={<Search size={18} color={themeColors.inactive} />}
          rightElement={
            <View className="mr-2 flex-row items-center gap-1.5">
              {isSearching ? (
                <TouchableOpacity
                  className="bg-gray-background rounded-md p-1"
                  onPress={() => setSearch("")}
                >
                  <X size={18} color={themeColors.onSurface} />
                </TouchableOpacity>
              ) : null}
              {isSearching && isFetching ? (
                <ActivityIndicator size="small" color={themeColors.brand} />
              ) : (
                <Tag>{`${organizations?.length ?? 0}`}</Tag>
              )}
            </View>
          }
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {isLoading ? (
        <View className="items-center py-10">
          <ActivityIndicator size="large" color={themeColors.brand} />
          <Text className="text-muted-body mt-3 text-center">{t("loading")}</Text>
        </View>
      ) : !organizations || (error && organizations.length === 0) ? (
        <View className="items-center py-10">
          <Text className="text-error text-center">{t("loadFailed")}</Text>
        </View>
      ) : (
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
          renderItem={({ item }) => (
            <OrganizationCard organization={item} onPress={openOrganization} />
          )}
        />
      )}
    </View>
  );
}

export default OrganizationsDirectoryScreen;
