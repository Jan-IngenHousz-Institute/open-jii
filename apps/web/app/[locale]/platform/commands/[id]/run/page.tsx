"use client";

import { ProtocolRunContent } from "@/components/protocol-run/protocol-run-content";
import { use } from "react";

interface ProtocolRunPageProps {
  params: Promise<{ id: string }>;
}

export default function ProtocolRunPage({ params }: ProtocolRunPageProps) {
  const { id } = use(params);

  return <ProtocolRunContent protocolId={id} />;
}
