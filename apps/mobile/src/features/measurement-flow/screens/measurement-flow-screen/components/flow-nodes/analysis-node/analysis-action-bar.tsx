import { ChevronUp } from "lucide-react-native";
import React, { useCallback, useRef, useState } from "react";
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  Text,
  View,
  TouchableOpacity,
} from "react-native";
import { useTranslation } from "~/shared/i18n";
import { Button } from "~/shared/ui/Button";
import { useTheme } from "~/shared/ui/hooks/use-theme";

const SCROLL_THRESHOLD = 100;

export function useScrollToTop() {
  const scrollViewRef = useRef<ScrollView>(null);
  const [hasScrolled, setHasScrolled] = useState(false);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setHasScrolled(event.nativeEvent.contentOffset.y > SCROLL_THRESHOLD);
  }, []);

  const scrollToTop = useCallback(() => {
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  }, []);

  return { scrollViewRef, hasScrolled, handleScroll, scrollToTop };
}

interface AnalysisActionBarProps {
  hasScrolled: boolean;
  isUploading: boolean;
  onScrollToTop: () => void;
  onRetry: () => void;
  onUpload: () => void;
  /** Offered in an experiment with a layout: keeps the reading and measures the same plot again. */
  onMeasureAgain?: () => void;
}

export function AnalysisActionBar({
  hasScrolled,
  isUploading,
  onScrollToTop,
  onRetry,
  onUpload,
  onMeasureAgain,
}: AnalysisActionBarProps) {
  const { colors } = useTheme();
  const { t } = useTranslation("measurementFlow");

  const discardButton = (
    <Button
      title={t("measurementFlow:analysis.actionBar.discardRetry")}
      onPress={onRetry}
      variant="tertiary"
      style={{ flex: 1, height: 44, borderColor: "transparent" }}
    />
  );

  const acceptButton = (
    <Button
      title={
        isUploading
          ? t("measurementFlow:analysis.actionBar.uploading")
          : t("measurementFlow:analysis.actionBar.acceptData")
      }
      onPress={onUpload}
      disabled={isUploading}
      style={{ flex: 1, height: 44 }}
    />
  );

  return (
    <View className="relative w-full py-3">
      {/* Floating scroll button */}
      {hasScrolled && (
        <TouchableOpacity
          onPress={onScrollToTop}
          activeOpacity={0.8}
          className="absolute -top-20 right-0 h-14 w-14 items-center justify-center rounded-full shadow-md"
          style={{
            backgroundColor: `${colors.surface}CC`,
          }}
        >
          <ChevronUp size={20} color={`${colors.onSurface}CC`} />
        </TouchableOpacity>
      )}
      {onMeasureAgain ? (
        // In an experiment with a layout the two ways of taking another reading sit side by side,
        // under a line saying what each does to the reading on screen.
        <View className="gap-3">
          <Text className="text-muted-body text-[13px] leading-5">
            {t("measurementFlow:analysis.actionBar.anotherReadingHint")}
          </Text>
          <View className="flex-row gap-3">
            <Button
              title={t("measurementFlow:analysis.actionBar.discardAndRetry")}
              onPress={onRetry}
              variant="tertiary"
              multiline
              numberOfLines={2}
              style={{ flex: 1, minHeight: 56, borderColor: "transparent" }}
            />
            <Button
              title={t("measurementFlow:analysis.actionBar.keepAndMeasureAgain")}
              onPress={onMeasureAgain}
              disabled={isUploading}
              variant="outline"
              multiline
              numberOfLines={2}
              style={{ flex: 1, minHeight: 56 }}
            />
          </View>
          <View className="flex-row">{acceptButton}</View>
        </View>
      ) : (
        <View className="flex-row gap-4">
          {discardButton}
          {acceptButton}
        </View>
      )}
    </View>
  );
}
