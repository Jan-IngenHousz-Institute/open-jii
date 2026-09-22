import { useLocalSearchParams, useNavigation } from "expo-router";
import { Search, X } from "lucide-react-native";
import React, { useCallback, useLayoutEffect, useMemo, useState } from "react";
import { ActivityIndicator, TouchableOpacity, View } from "react-native";
import { useTranslation } from "~/shared/i18n";
import { Input } from "~/shared/ui/Input";
import { TabBar } from "~/shared/ui/TabBar";
import { Tag } from "~/shared/ui/Tag";
import { SEARCH_DEBOUNCE_MS, useDebouncedValue } from "~/shared/ui/hooks/use-debounced-value";
import { useThemeColors } from "~/shared/ui/hooks/use-theme-colors";

import { ExperimentsSection } from "./experiments-section";
import { OrganizationsSection } from "./organizations-section";

const DISCOVER_TABS = ["experiments", "organizations"] as const;
type DiscoverTab = (typeof DISCOVER_TABS)[number];

function resolveTab(raw: string | string[] | undefined): DiscoverTab {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return DISCOVER_TABS.includes(value as DiscoverTab) ? (value as DiscoverTab) : "experiments";
}

export function DiscoverScreen() {
  const themeColors = useThemeColors();
  const navigation = useNavigation();
  const { t } = useTranslation(["discover", "common"]);
  const params = useLocalSearchParams<{ tab?: string }>();

  // The param picks the landing tab; switching after that is local, so the
  // choice is not remembered between visits.
  const [activeTab, setActiveTab] = useState<DiscoverTab>(() => resolveTab(params.tab));
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState({ count: 0, isFetching: false });

  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);

  useLayoutEffect(() => {
    navigation.setOptions({ title: t("discover:title") });
  }, [navigation, t]);

  const handleTabChange = useCallback((key: DiscoverTab) => {
    setActiveTab(key);
    setStatus({ count: 0, isFetching: false });
  }, []);

  const tabs = useMemo(
    () => [
      { key: "experiments" as const, label: t("discover:tabs.experiments") },
      { key: "organizations" as const, label: t("discover:tabs.organizations") },
    ],
    [t],
  );

  const isSearching = search.trim().length > 0;

  return (
    <View className="flex-1">
      <View className="px-4 pb-2 pt-4">
        <Input
          value={search}
          onChangeText={setSearch}
          transparent
          placeholder={t("discover:search.placeholder")}
          leftIcon={<Search size={18} color={themeColors.inactive} />}
          rightElement={
            <View className="mr-2 flex-row items-center gap-1.5">
              {isSearching ? (
                <TouchableOpacity
                  className="bg-gray-background rounded-md p-1"
                  onPress={() => setSearch("")}
                  accessibilityRole="button"
                  accessibilityLabel={t("discover:search.clear")}
                >
                  <X size={18} color={themeColors.onSurface} />
                </TouchableOpacity>
              ) : null}
              {isSearching && status.isFetching ? (
                <ActivityIndicator size="small" color={themeColors.brand} />
              ) : (
                <Tag>{`${status.count}`}</Tag>
              )}
            </View>
          }
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <View className="px-4 pb-2">
        <TabBar<DiscoverTab>
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          variant="underline"
        />
      </View>

      {activeTab === "experiments" ? (
        <ExperimentsSection
          search={debouncedSearch}
          enabled={activeTab === "experiments"}
          onStatusChange={setStatus}
        />
      ) : (
        <OrganizationsSection
          search={debouncedSearch}
          enabled={activeTab === "organizations"}
          onStatusChange={setStatus}
        />
      )}
    </View>
  );
}

export default DiscoverScreen;
