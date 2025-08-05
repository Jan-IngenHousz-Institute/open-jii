import type { Metadata } from "next";
import type React from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "Jan IngenHousz Institut",
  description: "Improving photosynthesis for a sustainable future",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
