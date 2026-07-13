import { NewCommandForm } from "@/components/new-command/new-command";
import { PageContainer } from "@/components/page-container";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "New Command",
};

export default function NewCommandPage() {
  return (
    <PageContainer width="reading" className="space-y-6">
      <NewCommandForm />
    </PageContainer>
  );
}
