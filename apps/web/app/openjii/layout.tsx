import { Breadcrumbs } from "@/components/app-breadcrumbs";
import { AppSidebar } from "@/components/app-sidebar";
import type { Metadata } from "next";
import { Poppins, Overpass } from "next/font/google";
import { headers } from "next/headers";
import type React from "react";

import { cn } from "@repo/ui";
import { Separator } from "@repo/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@repo/ui/sidebar";
import { ThemeProvider } from "@repo/ui/theme";

import "../globals.css";

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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = (await headers()).get("x-current-path") ?? "/";

  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body
        className={cn(
          "bg-background font-overpass min-h-screen antialiased",
          poppins.variable,
          overpass.variable,
        )}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
              <header className="group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear">
                <div className="flex items-center gap-2 px-4">
                  <SidebarTrigger className="-ml-1" />
                  <Separator
                    orientation="vertical"
                    className="mr-2 data-[orientation=vertical]:h-4"
                  />
                  <Breadcrumbs pathname={pathname} />
                </div>
              </header>
              {children}
            </SidebarInset>
          </SidebarProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
