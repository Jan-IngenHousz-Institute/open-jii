"use client";

import { QRCodeSVG } from "qrcode.react";

/**
 * Scanners assume dark modules on a light field, and the QR spec requires a
 * four-module quiet zone around them. Both are fixed here rather than tied to
 * theme tokens: a themed code inverts in dark mode and a transparent one has no
 * quiet zone at all, and either failure is invisible to whoever displays it.
 */
const FOREGROUND = "#18181b";
const BACKGROUND = "#ffffff";
const QUIET_ZONE_MODULES = 4;

interface QrCodeProps {
  /** Encoded verbatim. Callers pass the exact string a scanner should receive. */
  value: string;
  /** Rendered edge length in pixels, quiet zone included. */
  size?: number;
  className?: string;
}

export function QrCode({ value, size = 192, className }: QrCodeProps) {
  return (
    <QRCodeSVG
      value={value}
      size={size}
      level="M"
      bgColor={BACKGROUND}
      fgColor={FOREGROUND}
      marginSize={QUIET_ZONE_MODULES}
      className={className}
    />
  );
}
