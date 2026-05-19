import { LinearGradient } from "expo-linear-gradient";
import { X } from "lucide-react-native";
import React, { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFlowStepInfo } from "~/features/measurement-flow/hooks/use-flow-step-info";
import { colors } from "~/shared/constants/colors";
import { useTranslation } from "~/shared/i18n";

interface FlowHeroProps {
  title: string;
  onExitPress: () => void;
}

/**
 * Hero chrome that sits on top of the screen-level photo backdrop.
 * Background gradients + eyebrow + X + progress strip live here; the
 * photo itself is owned by MeasurementFlowScreen so it can extend behind
 * the rounded card body.
 */
export function FlowHero({ title, onExitPress }: FlowHeroProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation("measurementFlow");
  const { currentStep, totalSteps, stepTypeKey, progress } = useFlowStepInfo();

  const progressValue = useSharedValue(progress);
  useEffect(() => {
    progressValue.value = withTiming(progress, {
      duration: 320,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress, progressValue]);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progressValue.value * 100}%`,
  }));

  return (
    <View style={{ paddingTop: insets.top, position: "relative" }}>
      {/* Soft top-center bright-green highlight for the brand accent.
          The dark-teal mask is owned by MeasurementFlowScreen so it can
          extend the full photo area, not just this hero box. */}
      <LinearGradient
        colors={["rgba(73,224,109,0.18)", "rgba(73,224,109,0)"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.65 }}
        className="absolute inset-0"
        style={{ pointerEvents: "none" }}
      />

      <View className="px-5 pb-5 pt-3">
        <View className="flex-row items-start justify-between">
          <View className="flex-1 pr-3">
            <Text className="text-[11px] font-bold text-white/70" style={{ letterSpacing: 1.6 }}>
              {t("hero.activeFlow")}
            </Text>
            <Text
              numberOfLines={2}
              className="mt-1 text-white"
              style={{ fontFamily: "Poppins-Bold", fontSize: 22, lineHeight: 26 }}
            >
              {title}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("hero.exitLabel")}
            onPress={onExitPress}
            hitSlop={8}
            className="h-10 w-10 items-center justify-center rounded-full bg-white/15"
          >
            <X size={22} color="#FFFFFF" />
          </Pressable>
        </View>

        <View className="mt-5">
          <View className="flex-row items-center justify-between">
            <Text className="text-[12px] text-white/80">
              {t("hero.stepOfTotal", { step: currentStep, total: totalSteps })}
            </Text>
            <Text className="text-[12px] text-white/80">
              {t(`hero.stepTypeLabel.${stepTypeKey}` as const)}
            </Text>
          </View>
          <View className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15">
            <Animated.View
              style={[{ height: "100%", backgroundColor: colors.jii.brightGreen }, progressStyle]}
            />
          </View>
        </View>
      </View>
    </View>
  );
}
