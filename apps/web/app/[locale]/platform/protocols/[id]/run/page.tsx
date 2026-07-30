import { ProtocolRunContent } from "@/components/protocol-run/protocol-run-content";
import { buildProtocolRunMetadata } from "@/lib/platform-metadata";
import { safeMetadata } from "@/lib/safe-metadata";
import type { Metadata } from "next";

interface ProtocolRunPageProps {
  params: Promise<{ locale: string; id: string }>;
}

export function generateMetadata({ params }: ProtocolRunPageProps): Promise<Metadata> {
  return safeMetadata(async () => {
    const { locale, id } = await params;
    return buildProtocolRunMetadata({ locale, id });
  });
}

export default async function ProtocolRunPage({ params }: ProtocolRunPageProps) {
  const { id } = await params;

  return <ProtocolRunContent protocolId={id} />;
}
