import { clsx } from "clsx";
import { ChevronUp } from "lucide-react-native";
import React, { useCallback, useRef, useState } from "react";
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  View,
  Text,
  TouchableOpacity,
} from "react-native";
import { Button } from "~/components/Button";
import { useTheme } from "~/hooks/use-theme";

const SCROLL_THRESHOLD = 50;

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
}

export function AnalysisActionBar({
  hasScrolled,
  isUploading,
  onScrollToTop,
  onRetry,
  onUpload,
}: AnalysisActionBarProps) {
  const { classes, colors } = useTheme();

  if (hasScrolled) {
    return (
      <View className="w-full items-start py-3">
        <TouchableOpacity
          onPress={onScrollToTop}
          className={clsx("-ml-4 h-[44px] flex-row items-center justify-end gap-1 px-4")}
          activeOpacity={0.7}
        >
          <ChevronUp size={20} color={colors.onSurface} />
          <Text className={clsx("text-lg font-medium", classes.text)}>Scroll to top</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-row gap-4 py-3">
      <Button
        title="Discard & retry"
        onPress={onRetry}
        variant="tertiary"
        style={{ flex: 1, height: 44, borderColor: "transparent" }}
      />
      <Button
        title={isUploading ? "Uploading..." : "Accept data"}
        onPress={onUpload}
        disabled={isUploading}
        style={{ flex: 1, height: 44 }}
      />
    </View>
  );
}
