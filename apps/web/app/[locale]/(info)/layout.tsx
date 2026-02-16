import { UnifiedNavbar } from "@/components/navigation/unified-navbar/unified-navbar";
import { draftMode } from "next/headers";
import React from "react";
import { auth } from "~/app/actions/auth";
import { getContentfulClients } from "~/lib/contentful";

import { HomeFooter } from "@repo/cms";
import type { FooterFieldsFragment } from "@repo/cms/lib/__generated/sdk";
import { Toaster } from "@repo/ui/components";

interface InfoLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function InfoGroupLayout({ children, params }: InfoLayoutProps) {
  const { isEnabled: preview } = await draftMode();
  const { locale } = await params;
  const session = await auth();

  // Fetch Contentful footer data (with preview support)
  const { previewClient, client } = await getContentfulClients();
  const gqlClient = preview ? previewClient : client;
  const footerQuery = await gqlClient.footer({ locale, preview });
  const footerData = footerQuery.footerCollection?.items[0] as FooterFieldsFragment;

  return (
    <>
      <UnifiedNavbar locale={locale} session={session} />
      <div className="mx-auto flex w-full max-w-7xl justify-center">
        <main className="flex min-h-screen w-full flex-col px-4">{children}</main>
      </div>
      <HomeFooter footerData={footerData} preview={preview} locale={locale} />
      <Toaster />
    </>
  );
}
