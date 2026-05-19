import React, { ReactNode } from "react";
import { Image, Text, View } from "react-native";
import { cn } from "~/shared/utils/cn";

interface AvatarProps {
  uri?: string;
  initials?: string;
  size?: number;
  backgroundClassName?: string;
  textClassName?: string;
  icon?: ReactNode;
  className?: string;
}

export function Avatar({
  uri,
  initials,
  size = 36,
  backgroundClassName = "bg-jii-mint",
  textClassName = "text-jii-darker-green",
  icon,
  className,
}: AvatarProps) {
  const dimensionStyle = { width: size, height: size, borderRadius: size / 2 };

  const inner = (() => {
    if (uri) {
      return <Image source={{ uri }} style={{ width: size, height: size }} />;
    }
    if (icon) return icon;
    return (
      <Text
        className={cn("font-bold", textClassName)}
        style={{ fontFamily: "Poppins-Bold", fontSize: Math.max(10, size * 0.4) }}
      >
        {initials ?? ""}
      </Text>
    );
  })();

  return (
    <View
      className={cn("items-center justify-center overflow-hidden", backgroundClassName, className)}
      style={dimensionStyle}
    >
      {inner}
    </View>
  );
}
