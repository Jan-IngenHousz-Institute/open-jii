import type { Metadata } from "next";
import { Poppins, Overpass } from "next/font/google";
import type React from "react";

import { cn } from "@repo/ui/lib/utils";

import { QueryProvider } from "../providers/QueryProvider";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-poppins",
});

const overpass = Overpass({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-overpass",
});

export const metadata: Metadata = {
  title: "Jan IngenHousz Institute",
  description: "Improving photosynthesis for a sustainable future",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={cn(
          "bg-background font-overpass min-h-screen antialiased",
          poppins.variable,
          overpass.variable,
        )}
      >
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
