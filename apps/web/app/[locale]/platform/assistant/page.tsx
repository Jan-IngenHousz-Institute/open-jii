import { AssistantWorkspace } from "@/components/assistant/assistant-workspace";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "~/app/actions/auth";
import { isAssistantEnabled } from "~/lib/posthog-server";

export const metadata: Metadata = {
  title: "Assistant",
};

export default async function AssistantPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user) notFound();
  const enabled = await isAssistantEnabled(session.user.id);
  if (!enabled) notFound();
  return <AssistantWorkspace locale={locale} />;
}
