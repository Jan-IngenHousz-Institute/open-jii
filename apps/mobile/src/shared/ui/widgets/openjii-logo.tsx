/* eslint-disable @typescript-eslint/no-require-imports */
import React from "react";
import { Image } from "react-native";

const logoSource = require("../../../../assets/openjii-logo-horizontal.png");

// The horizontal logo PNG ships at 1200x563 (~2.135:1).
const ASPECT = 1200 / 563;

interface OpenJiiLogoProps {
  /** Logo height in dp; width is derived from the intrinsic ratio. */
  height?: number;
}

export function OpenJiiLogo({ height = 28 }: OpenJiiLogoProps) {
  return (
    <Image source={logoSource} style={{ height, width: height * ASPECT }} resizeMode="contain" />
  );
}
