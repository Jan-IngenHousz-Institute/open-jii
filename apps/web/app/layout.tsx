import { INDEXABLE, SITE_URL } from "@/lib/site-url";
import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import type { ReactNode } from "react";

import { ThemeProvider } from "@repo/ui/components/theme";
import { cn } from "@repo/ui/lib/utils";

import { CookieBanner } from "../components/cookie-banner";
import { PostHogProvider } from "../providers/PostHogProvider";
import "./globals.css";

// The font variables have to sit on <html> so the `--font-sans`/`--font-mono`
// declarations in globals.css `:root` can resolve them.
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-inter",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-jetbrains-mono",
});

const title = "openJII - Open-science platform";
const description =
  "Open-science platform by the Jan Ingenhousz Institute for real-time analysis and visualization of photosynthesis data from IoT sensors, enabling collaborative plant science research.";

// Global fallback metadata used when a page does not define its own (via CMS or locally).
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: "openJII",
  title: {
    default: title,
    template: "%s | openJII",
  },
  description,
  keywords: [
    "photosynthesis research",
    "open science",
    "plant science",
    "IoT sensors",
    "research data visualization",
  ],
  creator: "Jan Ingenhousz Institute",
  publisher: "Jan Ingenhousz Institute",
  category: "science",
  openGraph: {
    title,
    description,
    siteName: "openJII",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
  robots: {
    index: INDEXABLE,
    follow: INDEXABLE,
    googleBot: {
      index: INDEXABLE,
      follow: INDEXABLE,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

interface RootLayoutProps {
  children: ReactNode;
}

/**
 * Root Layout Component
 *
 * This layout provides the required HTML structure for Next.js App Router.
 * The locale-specific attributes (lang, dir) are handled by the locale layout
 * through client-side effects to maintain proper internationalization.
 *
 * Requirements addressed:
 * - 2.1: Proper <html> and <body> tags in root layout
 * - 2.2: No Next.js framework warnings about missing layout tags
 * - 2.3: Follows Next.js App Router best practices
 * - 2.4: Proper locale-specific HTML structure delegation
 */
export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html suppressHydrationWarning className={cn(inter.variable, jetbrainsMono.variable)}>
      <body className="h-full">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <PostHogProvider>
            {children}
            <CookieBanner />
          </PostHogProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
