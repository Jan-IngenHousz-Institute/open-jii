"use client";

import { CommandRunContent } from "@/components/command-run/command-run-content";
import { use } from "react";

interface CommandRunPageProps {
  params: Promise<{ id: string }>;
}

export default function CommandRunPage({ params }: CommandRunPageProps) {
  const { id } = use(params);

  return <CommandRunContent commandId={id} />;
}
