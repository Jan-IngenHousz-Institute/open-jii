import { MapPin, Smartphone } from "lucide-react-native";
import React from "react";
import { Text, View } from "react-native";
import { colors } from "~/shared/constants/colors";
import { useTranslation } from "~/shared/i18n";
import { Banner } from "~/shared/ui/Banner";

import type { OtherPhoneSession } from "../screens/measurement-flow-screen/components/flow-nodes/plot-node/next-plot";

interface SessionStartPanelProps {
  plots: number;
  otherPhone?: OtherPhoneSession;
}

/** What Start begins in an experiment with a layout, made from the layout the phone downloaded. */
export function SessionStartPanel({ plots, otherPhone }: SessionStartPanelProps) {
  const { t } = useTranslation("measurementFlow");

  return (
    <View className="gap-2.5">
      {otherPhone ? (
        <Banner
          variant="yellow"
          icon={<Smartphone size={18} color="#92400e" />}
          title={t("sessionStart.otherPhoneTitle", { name: otherPhone.measurer })}
          body={t("sessionStart.otherPhoneBody", { time: otherPhone.startedAt })}
        />
      ) : null}

      <View className="bg-gray-background flex-row items-center gap-3 rounded-2xl p-3.5">
        <View className="bg-jii-mint h-9 w-9 items-center justify-center rounded-xl">
          <MapPin size={18} color={colors.jii.darkGreen} />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-on-surface text-[15px] font-bold">
            {t("sessionStart.plots", { plots })}
          </Text>
          <Text className="text-muted-body text-[13px]">{t("sessionStart.offline")}</Text>
        </View>
      </View>
    </View>
  );
}
