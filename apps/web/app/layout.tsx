import type { Metadata } from "next";
import type { ReactNode } from "react";

import { CookieBanner } from "../components/cookie-banner";
import { PostHogProvider } from "../providers/PostHogProvider";
import "./globals.css";

// Global fallback metadata used when a page does not define its own (via CMS or locally).
export const metadata: Metadata = {
  title: "openJII - Open-science platform",
  description:
    "Open-science platform by the Jan Ingenhousz Institute for real-time analysis and visualization of photosynthesis data from IoT sensors, enabling collaborative plant science research.",
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
    <html>
      <body className="h-full">
        <PostHogProvider>
          {children}
          <CookieBanner />
        </PostHogProvider>
      </body>
    </html>
  );
}
