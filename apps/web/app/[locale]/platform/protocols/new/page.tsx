import { PageContainer } from "@/components/page-container";
import { NewProtocolForm } from "@/components/new-protocol/new-protocol";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "New Protocol",
};

export default function NewProtocolPage() {
  return (
    <PageContainer width="reading" className="space-y-6">
      <NewProtocolForm />
    </PageContainer>
  );
}
