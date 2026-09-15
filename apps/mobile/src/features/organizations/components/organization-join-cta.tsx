import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { Clock } from "lucide-react-native";
import React, { useRef } from "react";
import { Text, View } from "react-native";
import { JoinRequestSheet } from "~/features/organizations/components/join-request-sheet";
import { isJoinable } from "~/features/organizations/domain/membership";
import { useCancelMyJoinRequest } from "~/features/organizations/hooks/use-cancel-my-join-request";
import { useTranslation } from "~/shared/i18n";
import { showAlert } from "~/shared/ui/AlertDialog";
import { Banner } from "~/shared/ui/Banner";
import { Button } from "~/shared/ui/Button";
import { useIsOnline } from "~/shared/ui/hooks/use-is-online";
import { useThemeColors } from "~/shared/ui/hooks/use-theme-colors";

import type {
  OrganizationMembershipStatus,
  OrganizationVisibility,
} from "@repo/api/domains/organization/organization.schema";

interface OrganizationJoinCtaProps {
  id: string;
  name: string;
  membershipStatus: OrganizationMembershipStatus;
  visibility: OrganizationVisibility;
}

export function OrganizationJoinCta({
  id,
  name,
  membershipStatus,
  visibility,
}: OrganizationJoinCtaProps) {
  const { t } = useTranslation(["common", "organizations"]);
  const { warningFg } = useThemeColors();
  const { data: online } = useIsOnline();
  const isOffline = online === false;
  const sheetRef = useRef<BottomSheetModal>(null);
  const { cancelRequest, isPending: isCancelling } = useCancelMyJoinRequest();

  if (membershipStatus === "member") return null;

  if (membershipStatus === "pending_request") {
    const confirmCancel = () => {
      showAlert(
        t("organizations:join.cancelConfirmTitle"),
        t("organizations:join.cancelConfirmBody", { name }),
        [
          {
            text: t("organizations:join.cancel"),
            variant: "danger",
            onPress: () => cancelRequest({ id }),
          },
          { text: t("common:cancel"), variant: "ghost" },
        ],
      );
    };

    return (
      <View className="mt-3 gap-2">
        <Banner
          variant="yellow"
          title={t("organizations:join.pending")}
          icon={<Clock size={18} color={warningFg} />}
        />
        <Button
          title={t("organizations:join.cancel")}
          onPress={confirmCancel}
          variant="light"
          isDisabled={isOffline || isCancelling}
          isLoading={isCancelling}
        />
        {isOffline ? (
          <Text className="text-muted-body text-center text-[12px]">
            {t("organizations:join.offlineHint")}
          </Text>
        ) : null}
      </View>
    );
  }

  if (!isJoinable({ membershipStatus, visibility })) return null;

  return (
    <View className="mt-3 gap-2">
      <Button
        title={t("organizations:join.cta")}
        onPress={() => sheetRef.current?.present()}
        isDisabled={isOffline}
        size="lg"
      />
      {isOffline ? (
        <Text className="text-muted-body text-center text-[12px]">
          {t("organizations:join.offlineHint")}
        </Text>
      ) : null}
      <JoinRequestSheet ref={sheetRef} organizationId={id} organizationName={name} />
    </View>
  );
}
