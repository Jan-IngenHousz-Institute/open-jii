import { AssistantCorpusDetail } from "@/components/assistant/assistant-corpus-detail";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "~/app/actions/auth";
import { isAssistantEnabled } from "~/lib/posthog-server";

export const metadata: Metadata = { title: "Literature source" };

export default async function CorpusSourcePage({
  params,
}: {
  params: Promise<{ locale: string; workId: string }>;
}) {
  const { workId } = await params;
  const session = await auth();
  if (!session?.user || !(await isAssistantEnabled(session.user.id))) notFound();
  return <AssistantCorpusDetail workId={workId} />;
}
