import type { Metadata } from "next";
import type { ReactNode } from "react";

import { PostHogProvider } from "../providers/PostHogProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Jan IngenHousz Institute",
  description: "Improving photosynthesis for a sustainable future",
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
        <PostHogProvider>{children}</PostHogProvider>
      </body>
    </html>
  );
}
