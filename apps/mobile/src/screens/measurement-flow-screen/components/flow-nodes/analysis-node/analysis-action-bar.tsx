import { ChevronUp } from "lucide-react-native";
import React, { useCallback, useRef, useState } from "react";
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  View,
  TouchableOpacity,
} from "react-native";
import { Button } from "~/components/Button";
import { useTheme } from "~/hooks/use-theme";

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
}

export function AnalysisActionBar({
  hasScrolled,
  isUploading,
  onScrollToTop,
  onRetry,
  onUpload,
}: AnalysisActionBarProps) {
  const { colors } = useTheme();

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
      <View className="flex-row gap-4">
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
    </View>
  );
}
